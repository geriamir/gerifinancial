import { buildScript } from '../script';
import { OnboardingStatus } from '../../../../services/api/onboarding';

const baseStatus = (overrides: Partial<OnboardingStatus> = {}): OnboardingStatus => ({
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
  completedSteps: [],
  ...overrides
});

const connected = (overrides: Partial<OnboardingStatus> = {}) =>
  baseStatus({
    currentStep: 'transaction-import',
    completedSteps: ['checking-account'],
    checkingAccount: {
      connected: true,
      accountId: { _id: 'a1', bankId: 'leumi', displayName: 'Main Checking' },
      connectedAt: '2026-01-01T00:00:00Z',
      bankId: 'leumi'
    },
    ...overrides
  });

const imported = (overrides: Partial<OnboardingStatus> = {}) =>
  connected({
    currentStep: 'credit-card-detection',
    completedSteps: ['checking-account', 'transaction-import'],
    transactionImport: {
      completed: true,
      transactionsImported: 1432,
      completedAt: '2026-01-01T00:05:00Z',
      scrapingStatus: { isActive: false, status: 'complete', progress: 100, message: null, error: null }
    },
    ...overrides
  });

const cardsOf = (script: ReturnType<typeof buildScript>) =>
  script.messages.filter((message) => message.kind === 'card').map((message: any) => message.card);

const textOf = (script: ReturnType<typeof buildScript>) =>
  script.messages
    .filter((message) => message.kind !== 'card')
    .map((message: any) => message.text)
    .join('\n');

describe('buildScript', () => {
  it('waits rather than inventing a conversation before the status arrives', () => {
    const script = buildScript(null);

    expect(script.messages).toEqual([]);
    expect(script.waiting).toBe(true);
  });

  it('opens by asking for the checking account', () => {
    const script = buildScript(baseStatus());

    expect(cardsOf(script)).toEqual(['checking-account']);
    expect(script.waiting).toBe(false);
  });

  // The transcript is rebuilt from the same state that drives the flow, so a
  // refresh mid-setup has to land in the same place rather than starting over.
  it('replays the earlier exchange once a step is behind the user', () => {
    const script = buildScript(connected());

    expect(textOf(script)).toContain('Main Checking');
    expect(cardsOf(script)).toEqual(['import-progress']);
  });

  // The status endpoint never returns credentials, so the echoed answer has
  // nothing to leak. This pins that the builder does not reach for them either.
  it('echoes the account without any credential material', () => {
    const script = buildScript(connected());
    const transcript = textOf(script).toLowerCase();

    expect(transcript).not.toContain('password');
    expect(transcript).not.toContain('username');
  });

  it('reports what the import actually brought in', () => {
    const script = buildScript(imported());

    expect(textOf(script)).toContain('1,432 transactions');
  });

  it('waits with no card while the detection is still running', () => {
    const script = buildScript(
      imported({
        creditCardDetection: {
          analyzed: false,
          analyzedAt: null,
          transactionCount: 0,
          recommendation: null,
          sampleTransactions: []
        }
      })
    );

    expect(cardsOf(script)).toEqual([]);
    expect(script.waiting).toBe(true);
  });

  it('offers the choice once credit card activity has been analysed', () => {
    const script = buildScript(
      imported({
        creditCardDetection: {
          analyzed: true,
          analyzedAt: '2026-01-01T00:06:00Z',
          transactionCount: 47,
          recommendation: 'connect',
          sampleTransactions: []
        }
      })
    );

    expect(textOf(script)).toContain('47 credit card payments');
    expect(cardsOf(script)).toEqual(['credit-card-choice']);
  });

  it('phrases the choice differently when there is barely any card activity', () => {
    const script = buildScript(
      imported({
        creditCardDetection: {
          analyzed: true,
          analyzedAt: '2026-01-01T00:06:00Z',
          transactionCount: 0,
          recommendation: 'skip',
          sampleTransactions: []
        }
      })
    );

    expect(textOf(script)).toContain("didn't find any credit card payments");
    expect(cardsOf(script)).toEqual(['credit-card-choice']);
  });

  it('records the skip as the user\'s own reply', () => {
    const script = buildScript(
      imported({
        currentStep: 'complete',
        isComplete: true,
        creditCardDetection: {
          analyzed: true,
          analyzedAt: '2026-01-01T00:06:00Z',
          transactionCount: 0,
          recommendation: 'skip',
          sampleTransactions: []
        },
        creditCardSetup: { skipped: true, skippedAt: '2026-01-01T00:07:00Z', creditCardAccounts: [] }
      })
    );

    const replies = script.messages.filter((message) => message.kind === 'user').map((m: any) => m.text);
    expect(replies).toContain('Skip for now');
    expect(cardsOf(script)).toEqual(['complete']);
  });

  it('names the providers the user connected', () => {
    const script = buildScript(
      imported({
        currentStep: 'credit-card-matching',
        creditCardDetection: {
          analyzed: true,
          analyzedAt: '2026-01-01T00:06:00Z',
          transactionCount: 47,
          recommendation: 'connect',
          sampleTransactions: []
        },
        creditCardSetup: {
          skipped: false,
          skippedAt: null,
          creditCardAccounts: [
            {
              accountId: { _id: 'c1', bankId: 'max', displayName: 'Max Credit Cards' },
              connectedAt: '2026-01-01T00:08:00Z',
              bankId: 'max',
              displayName: 'Max Credit Cards'
            }
          ]
        }
      })
    );

    const replies = script.messages.filter((message) => message.kind === 'user').map((m: any) => m.text);
    expect(replies).toContain('Max');
    expect(script.waiting).toBe(true);
  });

  it('reviews the match once the payments have been reconciled', () => {
    const script = buildScript(
      imported({
        currentStep: 'credit-card-matching',
        creditCardDetection: {
          analyzed: true,
          analyzedAt: '2026-01-01T00:06:00Z',
          transactionCount: 47,
          recommendation: 'connect',
          sampleTransactions: []
        },
        creditCardMatching: {
          completed: true,
          completedAt: '2026-01-01T00:09:00Z',
          totalCreditCardPayments: 12,
          coveredPayments: 11,
          uncoveredPayments: 1,
          coveragePercentage: 91.6,
          matchedPayments: []
        }
      })
    );

    expect(textOf(script)).toContain('11 of 12');
    expect(textOf(script)).toContain('92%');
    expect(cardsOf(script)).toEqual(['matching-review']);
  });

  it('ends on the completion card', () => {
    const script = buildScript(
      imported({
        currentStep: 'complete',
        isComplete: true,
        creditCardDetection: {
          analyzed: true,
          analyzedAt: '2026-01-01T00:06:00Z',
          transactionCount: 47,
          recommendation: 'connect',
          sampleTransactions: []
        }
      })
    );

    expect(cardsOf(script)).toEqual(['complete']);
    expect(script.waiting).toBe(false);
  });

  // Every message is rendered from its id, and the shell tells a genuinely new
  // line from a re-render by comparing them. Duplicates would make a message
  // vanish or replay.
  it('gives every message a unique id', () => {
    const script = buildScript(
      imported({
        currentStep: 'complete',
        isComplete: true,
        creditCardDetection: {
          analyzed: true,
          analyzedAt: '2026-01-01T00:06:00Z',
          transactionCount: 47,
          recommendation: 'connect',
          sampleTransactions: []
        },
        creditCardSetup: { skipped: true, skippedAt: '2026-01-01T00:07:00Z', creditCardAccounts: [] }
      })
    );

    const ids = script.messages.map((message) => message.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // The wizard used to grow the transcript by index, so a step completing
  // renumbered everything after it. Ids have to survive progress.
  it('keeps a message id stable as the conversation grows', () => {
    const early = buildScript(connected());
    const later = buildScript(imported());

    const greetEarly = early.messages.find((message) => message.id === 'greet');
    const greetLater = later.messages.find((message) => message.id === 'greet');

    expect(greetEarly).toBeDefined();
    expect(greetLater).toEqual(greetEarly);
  });

  // The status document is the script's only input, and onboarding is the
  // first page a new user sees, so a section missing from the payload must
  // not take the page down with it.
  it('survives a status document with sections missing', () => {
    const partial = {
      currentStep: 'checking-account',
      completedSteps: [],
      isComplete: false,
      transactionImport: { scrapingStatus: { isActive: false, status: 'pending', progress: 0 } },
      creditCardDetection: null,
      creditCardSetup: { creditCardAccounts: [] },
      creditCardMatching: { completed: false }
    } as unknown as OnboardingStatus;

    const script = buildScript(partial);

    expect(cardsOf(script)).toContain('checking-account');
  });
});
