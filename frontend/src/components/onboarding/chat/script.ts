import { OnboardingStatus } from '../../../services/api/onboarding';
import { CHECKING_ACCOUNT_BANKS, CREDIT_CARD_PROVIDERS } from '../../../constants/banks';
import { CardId, ChatMessage, Script } from './types';

/**
 * Turns the server's onboarding state into a conversation.
 *
 * The transcript is derived, never stored. Two things follow from that, and
 * both are the reason it is built this way:
 *
 *  - Reloading mid-setup rebuilds the same conversation, because the state it
 *    is drawn from is the same state that decides what happens next. A stored
 *    transcript could disagree with the actual progress; this one cannot.
 *  - The only material available to it is what `/onboarding/status` returns,
 *    which contains no credentials. The bubble echoing the user's answer
 *    physically cannot show a password, rather than relying on remembering to
 *    mask one.
 *
 * Message ids are stable and meaningful rather than positional, so a message
 * keeps its identity as the conversation grows and the shell can tell an
 * genuinely new line from a re-render.
 */
export const buildScript = (status: OnboardingStatus | null): Script => {
  const messages: ChatMessage[] = [];
  if (!status) return { messages, waiting: true };

  const say = (id: string, text: string) => {
    messages.push({ id, kind: 'assistant', text });
  };
  const echo = (id: string, text: string) => {
    messages.push({ id, kind: 'user', text });
  };
  const offer = (card: CardId): Script => {
    messages.push({ id: `card:${card}`, kind: 'card', card });
    return { messages, waiting: false };
  };
  const pause = (): Script => ({ messages, waiting: true });
  const settled = (): Script => ({ messages, waiting: false });

  say('greet', "Hi. I'll get GeriFinancial set up with you - it takes a couple of minutes.");
  say(
    'ask-checking',
    "Let's start with your main checking account. I'll bring in the past year of transactions so there's something to look at straight away."
  );

  // 1. Checking account.
  //
  // Every section below is read defensively. The status document is this
  // script's only input, so one missing branch would take the whole
  // onboarding page down - and it is the first page a new user sees. Older
  // user documents and partial payloads can both arrive without every
  // section populated, so none of them is assumed present.
  const checking = status.checkingAccount;
  if (!checking?.connected) return offer('checking-account');
  echo('answer-checking', describeCheckingAccount(checking));

  // 2. Import. The scrape is already running by the time we get here - it
  // starts when the account is saved, not when this card appears.
  const imported = status.transactionImport;
  if (!imported?.completed) {
    say('importing', "Connected. I'm pulling your transactions across now - you can leave this open.");
    return offer('import-progress');
  }
  say('imported', describeImport(imported.transactionsImported));

  // 3. Credit card detection.
  const detection = status.creditCardDetection;
  if (!detection?.analyzed) {
    say('analyzing', 'Let me look through those for credit card activity.');
    return pause();
  }
  say('detection', describeDetection(detection));

  if (status.currentStep === 'credit-card-detection') return offer('credit-card-choice');

  const setup = status.creditCardSetup;
  echo('answer-cards', setup?.skipped ? 'Skip for now' : "Let's connect them");

  // 4. Credit card provider.
  if (status.currentStep === 'credit-card-setup') {
    say('ask-provider', 'Which provider are your cards with?');
    return offer('credit-card-form');
  }
  const cardAccounts = setup?.creditCardAccounts ?? [];
  if (cardAccounts.length > 0) {
    echo('answer-provider', cardAccounts.map((account) => bankName(account.bankId)).join(', '));
  }

  // 5. Matching the card statements against the payments already imported.
  const matching = status.creditCardMatching;
  if (status.currentStep === 'credit-card-matching') {
    if (!matching?.completed) {
      say('matching', "Now I'm checking those cards against the payments in your checking account.");
      return pause();
    }
    say('matched', describeMatching(matching));
    return offer('matching-review');
  }

  // 6. Done.
  if (!status.isComplete && status.currentStep !== 'complete') return settled();
  say('complete', "That's everything - you're set up.");
  return offer('complete');
};

const bankName = (bankId?: string | null): string => {
  if (!bankId) return 'Your bank';
  const known = [...CHECKING_ACCOUNT_BANKS, ...CREDIT_CARD_PROVIDERS].find((bank) => bank.id === bankId);
  return known ? known.name : bankId;
};

const describeCheckingAccount = (checking: OnboardingStatus['checkingAccount']): string => {
  const name = bankName(checking.bankId || checking.accountId?.bankId);
  const displayName = checking.accountId?.displayName;
  return displayName ? `${name} \u00b7 ${displayName}` : name;
};

const describeImport = (count: number): string => {
  if (!count) return 'That worked. I did not find any transactions in the past year.';
  return `Imported ${count.toLocaleString()} transaction${count === 1 ? '' : 's'} and sorted them into categories.`;
};

const describeDetection = (detection: OnboardingStatus['creditCardDetection']): string => {
  const count = detection.transactionCount || 0;
  const payments = `${count} credit card payment${count === 1 ? '' : 's'}`;

  if (detection.recommendation === 'connect') {
    return `I found ${payments} in there. Those are the monthly bills - what you actually spent is only on the card statement. Connect your card provider and I can see that too.`;
  }
  if (count > 0) {
    return `I only found ${payments}, so cards look optional for you. You can still connect one, or skip and add it later.`;
  }
  return "I didn't find any credit card payments, so you can skip this. You can always add a card later from your account settings.";
};

const describeMatching = (matching: OnboardingStatus['creditCardMatching']): string => {
  const total = matching.totalCreditCardPayments || 0;
  if (total === 0) return "I couldn't find any credit card payments to match against.";

  const percentage = Math.round(matching.coveragePercentage || 0);
  const covered = `${matching.coveredPayments} of ${total}`;
  if (percentage >= 80) {
    return `Matched ${covered} of your credit card payments to a card - that covers ${percentage}% of them.`;
  }
  return `I matched ${covered} of your credit card payments, or ${percentage}%. The rest are probably on a card you haven't connected yet.`;
};
