import React, { useEffect, useMemo, useRef } from 'react';
import { Box, Typography, Alert, CircularProgress, LinearProgress } from '@mui/material';
import { useOnboarding } from '../../../hooks/useOnboarding';
import { OnboardingStatus } from '../../../services/api/onboarding';
import { buildScript } from './script';
import { useRevealedMessages } from './useRevealedMessages';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { CardId, ChatHandlers, CardProps } from './types';
import { CheckingAccountCard } from './cards/CheckingAccountCard';
import { ImportProgressCard } from './cards/ImportProgressCard';
import { CreditCardChoiceCard } from './cards/CreditCardChoiceCard';
import { CreditCardFormCard } from './cards/CreditCardFormCard';
import { MatchingReviewCard } from './cards/MatchingReviewCard';
import { CompleteCard } from './cards/CompleteCard';

const CARDS: Record<CardId, React.FC<CardProps>> = {
  'checking-account': CheckingAccountCard,
  'import-progress': ImportProgressCard,
  'credit-card-choice': CreditCardChoiceCard,
  'credit-card-form': CreditCardFormCard,
  'matching-review': MatchingReviewCard,
  complete: CompleteCard
};

/**
 * Progress follows `currentStep`, not `completedSteps.length`.
 *
 * The two disagree on a normal path. When credit card coverage comes back
 * partial, the server records both `credit-card-setup` and
 * `credit-card-matching` as completed while leaving `isComplete` false and
 * parking the user on the matching review - so counting completed steps would
 * show a finished bar above a question the user still has to answer.
 * Where they are is the honest measure.
 */
const STEPS: OnboardingStatus['currentStep'][] = [
  'checking-account',
  'transaction-import',
  'credit-card-detection',
  'credit-card-setup',
  'credit-card-matching',
  'complete'
];

const progressOf = (status: OnboardingStatus): number => {
  if (status.isComplete) return 100;
  const reached = STEPS.indexOf(status.currentStep);
  if (reached < 0) return 0;
  return (reached / (STEPS.length - 1)) * 100;
};

/**
 * Onboarding as a conversation.
 *
 * Nothing here is generated: the assistant's lines come from a fixed script
 * keyed on the server's onboarding state, and every answer the user gives comes
 * from a structured control. That is deliberate rather than a limitation -
 * this flow handles bank credentials, and there is no model anywhere in it to
 * send them to.
 */
export const OnboardingChat: React.FC = () => {
  const {
    status,
    loading,
    error,
    addCheckingAccount,
    addCreditCardAccount,
    repairCreditCardAccount,
    removeCreditCardAccount,
    proceedToCreditCardSetup,
    skipCreditCards,
    completeOnboarding
  } = useOnboarding();

  const handlers: ChatHandlers = useMemo(
    () => ({
      connectCheckingAccount: addCheckingAccount,
      connectCreditCardAccount: addCreditCardAccount,
      repairCreditCardAccount,
      removeCreditCardAccount,
      proceedToCreditCardSetup,
      skipCreditCards,
      completeOnboarding
    }),
    [
      addCheckingAccount,
      addCreditCardAccount,
      repairCreditCardAccount,
      removeCreditCardAccount,
      proceedToCreditCardSetup,
      skipCreditCards,
      completeOnboarding
    ]
  );

  const script = useMemo(() => buildScript(status), [status]);

  // Someone who has not connected an account yet has no history to skip, so
  // their opening lines are worth pacing. Anyone further along has already
  // lived through this and should land at the bottom of it.
  const isFirstVisit = !!status && !status.checkingAccount?.connected;
  const { visible, typing } = useRevealedMessages(script.messages, isFirstVisit);

  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [visible.length, typing]);

  if (loading && !status) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!status) {
    return (
      <Alert severity="error">
        We couldn't load your setup progress. Please refresh the page.
      </Alert>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '70vh' }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" component="h1">
          Setting up GeriFinancial
        </Typography>
        <LinearProgress
          variant="determinate"
          value={progressOf(status)}
          data-testid="onboarding-progress"
          sx={{ height: 4, borderRadius: 2, mt: 1 }}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error.message || 'Something went wrong. Please try again.'}
        </Alert>
      )}

      <Box
        role="log"
        aria-live="polite"
        aria-label="Setup conversation"
        sx={{ flex: 1 }}
        data-testid="onboarding-chat"
      >
        {visible.map((message) => {
          if (message.kind === 'card') {
            const Card = CARDS[message.card];
            return <Card key={message.id} status={status} handlers={handlers} />;
          }
          return <MessageBubble key={message.id} role={message.kind} text={message.text} />;
        })}

        {(typing || script.waiting) && <TypingIndicator />}
        <div ref={endRef} />
      </Box>
    </Box>
  );
};
