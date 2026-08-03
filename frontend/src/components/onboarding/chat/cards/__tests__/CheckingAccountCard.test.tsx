import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { CheckingAccountCard } from '../CheckingAccountCard';
import { CHECKING_ACCOUNT_BANKS } from '../../../../../constants/banks';
import { OnboardingStatus } from '../../../../../services/api/onboarding';
import { ChatHandlers } from '../../types';

const handlers: ChatHandlers = {
  connectCheckingAccount: jest.fn().mockResolvedValue(undefined),
  connectCreditCardAccount: jest.fn().mockResolvedValue(undefined),
  proceedToCreditCardSetup: jest.fn().mockResolvedValue(undefined),
  skipCreditCards: jest.fn().mockResolvedValue(undefined),
  completeOnboarding: jest.fn().mockResolvedValue(undefined)
};

const showCard = () => {
  render(<CheckingAccountCard status={{} as OnboardingStatus} handlers={handlers} />);
  return screen.getByTestId('bank-select');
};

describe('CheckingAccountCard bank selection', () => {
  // The whole point of showing the banks inline is recognising yours without
  // opening anything, so every one has to be on screen from the start.
  it('shows every bank up front rather than behind a dropdown', () => {
    const group = showCard();

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(within(group).getAllByRole('radio')).toHaveLength(CHECKING_ACCOUNT_BANKS.length);
  });

  it('marks every bank in the row with its own icon', () => {
    const group = showCard();

    for (const bank of CHECKING_ACCOUNT_BANKS) {
      expect(within(group).getByTestId(`bank-icon-${bank.id}`)).toBeInTheDocument();
    }
  });

  it('still names every bank, so the logo is a cue rather than the only label', () => {
    const group = showCard();

    for (const bank of CHECKING_ACCOUNT_BANKS) {
      expect(within(group).getByText(bank.name)).toBeInTheDocument();
    }
  });

  it('marks the chosen bank as selected and leaves the rest alone', () => {
    const group = showCard();

    fireEvent.click(within(group).getByRole('radio', { name: 'Bank Leumi' }));

    expect(within(group).getByRole('radio', { name: 'Bank Leumi' })).toBeChecked();
    expect(within(group).getByRole('radio', { name: 'Bank Hapoalim' })).not.toBeChecked();
    expect(screen.getByTestId('bank-select-option-leumi')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('bank-select-option-hapoalim')).toHaveAttribute('data-selected', 'false');
  });

  // Each tile is a <label> around its own radio, so the bank name rendered
  // inside is what names the control. Swap that label for a plain element and
  // the group becomes four unnamed radios that clicking does not select.
  it('gives each option an accessible name', () => {
    const group = showCard();

    for (const bank of CHECKING_ACCOUNT_BANKS) {
      expect(within(group).getByRole('radio', { name: bank.name })).toBeInTheDocument();
    }
  });

  it('submits the bank that was clicked', async () => {
    const group = showCard();

    fireEvent.click(within(group).getByRole('radio', { name: 'Discount Bank' }));
    fireEvent.change(screen.getByLabelText(/online banking username/i), { target: { value: 'someone' } });
    fireEvent.change(screen.getByLabelText(/online banking password/i), { target: { value: 'secret' } });
    fireEvent.click(screen.getByTestId('connect-checking-btn'));

    await waitFor(() =>
      expect(handlers.connectCheckingAccount).toHaveBeenCalledWith(
        'discount',
        { username: 'someone', password: 'secret' },
        'Main Checking'
      )
    );
  });
});
