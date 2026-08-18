import { OnboardingStatus } from '../../../services/api/onboarding';

/**
 * The interactive attachments the assistant can put under a message. There is
 * deliberately no free-text input anywhere in this flow: every answer the user
 * gives comes from one of these, so nothing typed can be misread and no
 * credential can be entered anywhere but the field built to receive it.
 */
export type CardId =
  | 'checking-account'
  | 'import-progress'
  | 'credit-card-choice'
  | 'credit-card-form'
  | 'matching-review'
  | 'complete';

export type ChatMessage =
  | { id: string; kind: 'assistant'; text: string }
  | { id: string; kind: 'user'; text: string }
  | { id: string; kind: 'card'; card: CardId };

export interface Script {
  messages: ChatMessage[];
  /**
   * True when the next move belongs to the server rather than the user. The
   * shell shows a typing indicator instead of an empty pause, so the
   * conversation reads as waiting rather than as broken.
   */
  waiting: boolean;
}

export interface ChatHandlers {
  connectCheckingAccount: (
    bankId: string,
    credentials: { username: string; password: string },
    displayName: string
  ) => Promise<unknown>;
  connectCreditCardAccount: (
    bankId: string,
    credentials: { username: string; password: string; card6Digits?: string },
    displayName: string
  ) => Promise<unknown>;
  repairCreditCardAccount: (
    accountId: string,
    credentials: { username: string; password: string; card6Digits?: string }
  ) => Promise<unknown>;
  removeCreditCardAccount: (accountId: string) => Promise<unknown>;
  proceedToCreditCardSetup: () => Promise<void>;
  skipCreditCards: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

export interface CardProps {
  status: OnboardingStatus;
  handlers: ChatHandlers;
}
