import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError } from 'axios';
import { OnboardingChat } from '../OnboardingChat';
import { OnboardingStatus } from '../../../../services/api/onboarding';

const mockAddCheckingAccount = jest.fn().mockResolvedValue({});
const mockAddCreditCardAccount = jest.fn().mockResolvedValue({});
const mockProceedToCreditCardSetup = jest.fn().mockResolvedValue(undefined);
const mockSkipCreditCards = jest.fn().mockResolvedValue(undefined);
const mockCompleteOnboarding = jest.fn().mockResolvedValue(undefined);

let mockStatus: OnboardingStatus | null = null;

jest.mock('../../../../hooks/useOnboarding', () => ({
  useOnboarding: () => ({
    status: mockStatus,
    loading: false,
    error: null,
    refetch: jest.fn(),
    addCheckingAccount: mockAddCheckingAccount,
    addCreditCardAccount: mockAddCreditCardAccount,
    proceedToCreditCardSetup: mockProceedToCreditCardSetup,
    skipCreditCards: mockSkipCreditCards,
    completeOnboarding: mockCompleteOnboarding
  })
}));

const fresh = (): OnboardingStatus => ({
  isComplete: false,
  currentStep: 'checking-account',
  startedAt: null,
  completedAt: null,
  checkingAccount: { connected: false, accountId: null, connectedAt: null, bankId: null },
  transactionImport: {
    completed: false,
    transactionsImported: 0,
    completedAt: null,
    scrapingStatus: { isActive: false, status: null, progress: 0, message: null, error: null }
  },
  creditCardDetection: {
    analyzed: false,
    analyzedAt: null,
    transactionCount: 0,
    recommendation: null,
    sampleTransactions: []
  },
  creditCardSetup: { skipped: false, skippedAt: null, creditCardAccounts: [] },
  creditCardMatching: {
    completed: false,
    completedAt: null,
    totalCreditCardPayments: 0,
    coveredPayments: 0,
    uncoveredPayments: 0,
    coveragePercentage: 0,
    matchedPayments: []
  },
  completedSteps: []
});

const importing = (): OnboardingStatus => ({
  ...fresh(),
  currentStep: 'transaction-import',
  completedSteps: ['checking-account'],
  checkingAccount: {
    connected: true,
    accountId: { _id: 'a1', bankId: 'leumi', displayName: 'Main Checking' },
    connectedAt: '2026-01-01T00:00:00Z',
    bankId: 'leumi'
  },
  transactionImport: {
    completed: false,
    transactionsImported: 0,
    completedAt: null,
    scrapingStatus: { isActive: true, status: 'scraping', progress: 45, message: null, error: null }
  }
});

const draw = () =>
  render(
    <MemoryRouter>
      <OnboardingChat />
    </MemoryRouter>
  );

const fillForm = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByLabelText(/Your bank/i));
  await user.click(await screen.findByText('Bank Leumi'));
  await user.type(screen.getByLabelText(/Online banking username/i), 'someuser');
  await user.type(screen.getByLabelText(/Online banking password/i), 'hunter2');
  await user.click(screen.getByTestId('connect-checking-btn'));
};

describe('OnboardingChat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStatus = fresh();
  });

  it('opens the conversation and asks for the checking account', async () => {
    draw();

    expect(await screen.findByTestId('checking-account-setup', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByTestId('connect-checking-btn')).toBeInTheDocument();
  });

  // A user who is part-way through should land at the end of the conversation,
  // not watch their own answers being typed back at them.
  it('shows a resumed conversation without replaying it', async () => {
    mockStatus = importing();
    draw();

    expect(await screen.findByTestId('transaction-import-status')).toBeInTheDocument();
    expect(screen.getByText(/Main Checking/)).toBeInTheDocument();
    expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
  });

  it('hands the credentials to the API exactly once and keeps them out of the transcript', async () => {
    const user = userEvent.setup();
    draw();

    await screen.findByTestId('checking-account-setup', {}, { timeout: 5000 });

    await fillForm(user);

    await waitFor(() => expect(mockAddCheckingAccount).toHaveBeenCalledTimes(1));
    expect(mockAddCheckingAccount).toHaveBeenCalledWith(
      'leumi',
      { username: 'someuser', password: 'hunter2' },
      'Main Checking'
    );

    // The transcript is built from server state, which never carries a
    // password. This fails loudly if a bubble is ever fed from the form.
    expect(screen.getByTestId('onboarding-chat')).not.toHaveTextContent('hunter2');
  });

  // Mirrors the Cypress "Invalid bank credentials" case: whatever the API
  // says is what the user reads, rather than a generic failure.
  it('surfaces the API error on the card', async () => {
    const user = userEvent.setup();
    mockAddCheckingAccount.mockRejectedValueOnce(
      new AxiosError('rejected', 'ERR_BAD_REQUEST', undefined, undefined, {
        data: { error: 'Invalid bank credentials' },
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        config: { headers: {} } as never
      })
    );
    draw();

    await screen.findByTestId('checking-account-setup', {}, { timeout: 5000 });
    await fillForm(user);

    expect(await screen.findByText('Invalid bank credentials')).toBeInTheDocument();
  });

  // Waiting on a scrape is the longest silence in this flow. Silence in a chat
  // reads as broken, so the indicator has to stay up while the server works.
  it('keeps typing while the server is still working', async () => {
    mockStatus = {
      ...importing(),
      currentStep: 'credit-card-detection',
      completedSteps: ['checking-account', 'transaction-import'],
      transactionImport: {
        completed: true,
        transactionsImported: 42,
        completedAt: '2026-01-01T00:05:00Z',
        scrapingStatus: { isActive: false, status: 'complete', progress: 100, message: null, error: null }
      }
    };
    draw();

    expect(await screen.findByTestId('chat-typing')).toBeInTheDocument();
  });
});
