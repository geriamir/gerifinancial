import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { CreditCardFormCard } from '../CreditCardFormCard';
import { CREDIT_CARD_PROVIDERS } from '../../../../../constants/banks';
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
  render(<CreditCardFormCard status={{} as OnboardingStatus} handlers={handlers} />);
  return screen.getByTestId('provider-select');
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CreditCardFormCard provider selection', () => {
  // The point of showing the providers inline is recognising yours without
  // opening anything, so every one has to be on screen from the start.
  it('shows every provider up front rather than behind a dropdown', () => {
    const group = showCard();

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(within(group).getAllByRole('radio')).toHaveLength(CREDIT_CARD_PROVIDERS.length);
  });

  it('marks every provider in the row with its own icon', () => {
    const group = showCard();

    for (const provider of CREDIT_CARD_PROVIDERS) {
      expect(within(group).getByTestId(`bank-icon-${provider.id}`)).toBeInTheDocument();
    }
  });

  it('still names every provider, so the logo is a cue rather than the only label', () => {
    const group = showCard();

    for (const provider of CREDIT_CARD_PROVIDERS) {
      expect(within(group).getByText(provider.name)).toBeInTheDocument();
    }
  });

  it('marks the chosen provider as selected and leaves the rest alone', () => {
    const group = showCard();

    fireEvent.click(within(group).getByRole('radio', { name: 'Max' }));

    expect(within(group).getByRole('radio', { name: 'Max' })).toBeChecked();
    expect(within(group).getByRole('radio', { name: 'Isracard' })).not.toBeChecked();
    expect(screen.getByTestId('provider-select-option-max')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('provider-select-option-isracard')).toHaveAttribute('data-selected', 'false');
  });

  // Each tile is a <label> around its own radio, so the provider name rendered
  // inside is what names the control.
  it('gives each option an accessible name', () => {
    const group = showCard();

    for (const provider of CREDIT_CARD_PROVIDERS) {
      expect(within(group).getByRole('radio', { name: provider.name })).toBeInTheDocument();
    }
  });
});

describe('CreditCardFormCard submission', () => {
  it('submits the provider that was clicked, named after it', async () => {
    const group = showCard();

    fireEvent.click(within(group).getByRole('radio', { name: 'Isracard' }));
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'someone' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret' } });
    fireEvent.click(screen.getByTestId('connect-cards-btn'));

    await waitFor(() =>
      expect(handlers.connectCreditCardAccount).toHaveBeenCalledWith(
        'isracard',
        { username: 'someone', password: 'secret' },
        'Isracard Credit Cards'
      )
    );
  });

  // Nothing is selected on first render, so the provider is the field most
  // likely to be missed - and unlike the text inputs it has no browser-level
  // required prompt to fall back on.
  it('refuses to submit with no provider chosen', async () => {
    showCard();

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'someone' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret' } });
    fireEvent.click(screen.getByTestId('connect-cards-btn'));

    expect(await screen.findByText(/please fill in all required fields/i)).toBeInTheDocument();
    expect(handlers.connectCreditCardAccount).not.toHaveBeenCalled();
  });

  it('lets the whole step be skipped', async () => {
    showCard();

    fireEvent.click(screen.getByTestId('skip-cards-btn'));

    await waitFor(() => expect(handlers.skipCreditCards).toHaveBeenCalled());
  });
});
