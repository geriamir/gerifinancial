import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
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

const openBankList = () => {
  render(<CheckingAccountCard status={{} as OnboardingStatus} handlers={handlers} />);
  fireEvent.mouseDown(screen.getByRole('combobox'));
  return screen.getByRole('listbox');
};

describe('CheckingAccountCard bank selection', () => {
  it('marks every bank in the list with its own icon', () => {
    const list = openBankList();

    for (const bank of CHECKING_ACCOUNT_BANKS) {
      expect(within(list).getByTestId(`bank-icon-${bank.id}`)).toHaveTextContent(bank.monogram);
    }
  });

  it('still names every bank, so the icon is a cue rather than the only label', () => {
    const list = openBankList();

    for (const bank of CHECKING_ACCOUNT_BANKS) {
      expect(within(list).getByText(bank.name)).toBeInTheDocument();
    }
  });

  // The whole point of the icon is recognising the account you picked without
  // reading, so it has to survive into the closed control.
  it('keeps the icon visible once a bank is chosen', () => {
    const list = openBankList();

    fireEvent.click(within(list).getByText('Bank Leumi'));

    expect(within(screen.getByRole('combobox')).getByTestId('bank-icon-leumi')).toBeInTheDocument();
  });
});
