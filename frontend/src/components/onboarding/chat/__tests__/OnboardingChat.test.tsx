import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError } from 'axios';
import { OnboardingChat } from '../OnboardingChat';
import { OnboardingStatus } from '../../../../services/api/onboarding';

const mockAddCheckingAccount = jest.fn().mockResolvedValue({});
const mockAddCreditCardAccount = jest.fn().mockResolvedValue({});
const mockRepairCreditCardAccount = jest.fn().mockResolvedValue({});
const mockRemoveCreditCardAccount = jest.fn().mockResolvedValue({});
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
    repairCreditCardAccount: mockRepairCreditCardAccount,
    removeCreditCardAccount: mockRemoveCreditCardAccount,
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

const failedCard = (): OnboardingStatus => ({
  ...importing(),
  currentStep: 'credit-card-matching',
  completedSteps: ['checking-account', 'transaction-import', 'credit-card-detection', 'credit-card-setup'],
  transactionImport: {
    completed: true,
    transactionsImported: 42,
    completedAt: '2026-01-01T00:05:00Z',
    scrapingStatus: { isActive: false, status: 'complete', progress: 100, message: null, error: null }
  },
  creditCardDetection: {
    analyzed: true,
    analyzedAt: '2026-01-01T00:06:00Z',
    transactionCount: 5,
    recommendation: 'connect',
    sampleTransactions: []
  },
  creditCardSetup: {
    skipped: false,
    skippedAt: null,
    creditCardAccounts: [{
      accountId: { _id: 'failed-cal', bankId: 'visaCal', displayName: 'Visa Cal Credit Cards' },
      connectedAt: '2026-01-01T00:07:00Z',
      bankId: 'visaCal',
      displayName: 'Visa Cal Credit Cards'
    }]
  },
  creditCardMatching: {
    completed: true,
    completedAt: '2026-01-01T00:08:00Z',
    error: 'Visa Cal Credit Cards could not be imported.',
    failedAccount: {
      accountId: 'failed-cal',
      bankId: 'visaCal',
      displayName: 'Visa Cal Credit Cards',
      error: 'The bank requires a password change.'
    },
    totalCreditCardPayments: 5,
    coveredPayments: 2,
    uncoveredPayments: 3,
    coveragePercentage: 40,
    matchedPayments: []
  }
});

const draw = () =>
  render(
    <MemoryRouter>
      <OnboardingChat />
    </MemoryRouter>
  );

const fillForm = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('radio', { name: 'Bank Leumi' }));
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

  // Partial credit card coverage is a normal outcome, and on that path the
  // server records every step as completed while leaving isComplete false.
  // Counting completed steps would show a finished bar above a question the
  // user still has to answer.
  it('does not show full progress while the user still has a decision to make', async () => {
    mockStatus = {
      ...importing(),
      currentStep: 'credit-card-matching',
      isComplete: false,
      completedSteps: [
        'checking-account',
        'transaction-import',
        'credit-card-detection',
        'credit-card-setup',
        'credit-card-matching'
      ],
      transactionImport: {
        completed: true,
        transactionsImported: 42,
        completedAt: '2026-01-01T00:05:00Z',
        scrapingStatus: { isActive: false, status: 'complete', progress: 100, message: null, error: null }
      },
      creditCardDetection: {
        analyzed: true,
        analyzedAt: '2026-01-01T00:06:00Z',
        transactionCount: 5,
        recommendation: 'connect',
        sampleTransactions: []
      },
      creditCardMatching: {
        completed: true,
        completedAt: '2026-01-01T00:08:00Z',
        totalCreditCardPayments: 10,
        coveredPayments: 6,
        uncoveredPayments: 4,
        coveragePercentage: 60,
        matchedPayments: []
      }
    };
    draw();

    expect(await screen.findByTestId('matching-review')).toBeInTheDocument();
    const bar = screen.getByTestId('onboarding-progress');
    expect(Number(bar.getAttribute('aria-valuenow'))).toBeLessThan(100);
  });

  it('separates provider-level matches from connected card endings', async () => {
    mockStatus = {
      ...importing(),
      currentStep: 'credit-card-matching',
      completedSteps: ['checking-account', 'transaction-import', 'credit-card-detection', 'credit-card-setup'],
      transactionImport: {
        completed: true,
        transactionsImported: 42,
        completedAt: '2026-01-01T00:05:00Z',
        scrapingStatus: { isActive: false, status: 'complete', progress: 100, message: null, error: null }
      },
      creditCardDetection: {
        analyzed: true,
        analyzedAt: '2026-01-01T00:06:00Z',
        transactionCount: 5,
        recommendation: 'connect',
        sampleTransactions: []
      },
      creditCardSetup: {
        skipped: false,
        skippedAt: null,
        creditCardAccounts: []
      },
      creditCardMatching: {
        completed: true,
        completedAt: '2026-01-01T00:08:00Z',
        totalCreditCardPayments: 5,
        coveredPayments: 2,
        uncoveredPayments: 3,
        coveragePercentage: 40,
        matchedPayments: [{
          payment: {
            id: 'payment-1',
            date: '2026-08-10T00:00:00.000Z',
            description: 'Card payment',
            amount: 34208.45
          },
          matchedCreditCard: {
            id: 'card-1',
            displayName: 'Visa Cal Credit Cards',
            cardNumber: '0296',
            lastFourDigits: '0296',
            provider: 'visaCal'
          },
          matchedMonth: '2026-08',
          matchConfidence: 91
        }],
        connectedCreditCards: [
          { id: 'card-1', displayName: '0296', provider: 'visaCal' },
          { id: 'card-2', displayName: '4940', provider: 'visaCal' }
        ]
      }
    };
    draw();

    expect(await screen.findByText('Matched checking-account payments')).toBeInTheDocument();
    expect(screen.getByText(/34,208\.45/)).toBeInTheDocument();
    expect(screen.getByText('Matched to Visa Cal')).toBeInTheDocument();
    expect(screen.getByText('Connected cards (last 4 digits)')).toBeInTheDocument();
    expect(screen.getByText('ending 0296')).toBeInTheDocument();
    expect(screen.getByText('ending 4940')).toBeInTheDocument();
    expect(screen.getByText(/cannot always be assigned to one card ending/)).toBeInTheDocument();
  });

  it('shows the failed account and lets the user repair it', async () => {
    const user = userEvent.setup();
    mockStatus = failedCard();
    draw();

    expect(await screen.findByText('Visa Cal Credit Cards needs attention')).toBeInTheDocument();
    expect(screen.getByText('The bank requires a password change.')).toBeInTheDocument();

    await user.click(screen.getByTestId('fix-card-account-btn'));
    await user.type(await screen.findByTestId('repair-card-username'), 'cal-user');
    await user.type(screen.getByTestId('repair-card-password'), 'new-password');
    await user.click(screen.getByRole('button', { name: 'Save and retry' }));

    await waitFor(() => {
      expect(mockRepairCreditCardAccount).toHaveBeenCalledWith('failed-cal', {
        username: 'cal-user',
        password: 'new-password'
      });
    });
  });

  it('shows details from an Axios-compatible repair error', async () => {
    const user = userEvent.setup();
    mockStatus = failedCard();
    mockRepairCreditCardAccount.mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        data: { details: 503 }
      }
    });
    draw();

    await user.click(await screen.findByTestId('fix-card-account-btn'));
    await user.type(screen.getByTestId('repair-card-username'), 'cal-user');
    await user.type(screen.getByTestId('repair-card-password'), 'new-password');
    await user.click(screen.getByRole('button', { name: 'Save and retry' }));

    expect(await screen.findByText('503')).toBeInTheDocument();
  });

  it('confirms before removing the failed account', async () => {
    const user = userEvent.setup();
    mockStatus = failedCard();
    draw();

    await screen.findByTestId('failed-card-account');
    await user.click(screen.getByTestId('remove-card-account-btn'));
    expect(screen.getByText('Remove this connection from GeriFinancial?')).toBeInTheDocument();

    await user.click(screen.getByTestId('confirm-remove-card-account-btn'));
    await waitFor(() => {
      expect(mockRemoveCreditCardAccount).toHaveBeenCalledWith('failed-cal');
    });
  });

  it('shows full progress once onboarding is complete', async () => {
    mockStatus = { ...importing(), currentStep: 'complete', isComplete: true };
    draw();

    await screen.findByTestId('onboarding-chat');
    const bar = screen.getByTestId('onboarding-progress');
    expect(Number(bar.getAttribute('aria-valuenow'))).toBe(100);
  });
});
