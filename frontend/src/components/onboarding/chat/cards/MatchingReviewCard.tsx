import React, { useState } from 'react';
import { Box, Button, Typography, Stack, LinearProgress, Chip } from '@mui/material';
import { Add as AddIcon, CreditCard as CreditCardIcon } from '@mui/icons-material';
import { CardShell } from '../CardShell';
import { CardProps } from '../types';
import { CREDIT_CARD_PROVIDERS } from '../../../../constants/banks';
import { formatCurrencyDisplay } from '../../../../utils/formatters';

const providerName = (provider: string): string =>
  CREDIT_CARD_PROVIDERS.find((candidate) => candidate.id === provider)?.name || provider;

const PAYMENT_DATE_FORMATTER = new Intl.DateTimeFormat('en-IL', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Jerusalem'
});

const formatPaymentDate = (date: string): string => PAYMENT_DATE_FORMATTER.format(new Date(date));

/**
 * Shown once the card statements have been matched against the payments in the
 * checking account. Finishing is always allowed because a provider debit can
 * still be ambiguous when several card payments share the same date.
 */
export const MatchingReviewCard: React.FC<CardProps> = ({ status, handlers }) => {
  const [busy, setBusy] = useState<'more' | 'finish' | null>(null);
  const matching = status.creditCardMatching;
  const cards = matching?.connectedCreditCards || [];
  const matchedPayments = matching?.matchedPayments || [];
  const percentage = Math.round(matching?.coveragePercentage || 0);

  const run = async (action: 'more' | 'finish') => {
    setBusy(action);
    try {
      await (action === 'more' ? handlers.proceedToCreditCardSetup() : handlers.completeOnboarding());
    } finally {
      setBusy(null);
    }
  };

  return (
    <CardShell testId="matching-review">
      {(matching?.totalCreditCardPayments ?? 0) > 0 && (
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Payments matched to a card
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {percentage}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={percentage}
            color={percentage >= 80 ? 'success' : 'warning'}
            sx={{ height: 6, borderRadius: 3 }}
          />
        </Box>
      )}

      {matchedPayments.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Matched checking-account payments
          </Typography>
          <Stack spacing={1}>
            {matchedPayments.map((match) => (
              <Box key={match.payment.id}>
                <Typography variant="body2">
                  {formatPaymentDate(match.payment.date)} · {formatCurrencyDisplay(match.payment.amount)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Matched to {providerName(match.matchedCreditCard.provider)}
                </Typography>
              </Box>
            ))}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            A provider debit can combine several physical cards, so it cannot always be assigned to one card ending.
          </Typography>
        </Box>
      )}

      {cards.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Connected cards (last 4 digits)
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            {cards.map((card) => (
              <Chip
                key={card.id}
                icon={<CreditCardIcon />}
                label={`ending ${card.displayName}`}
                size="small"
              />
            ))}
          </Stack>
        </Box>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => run('more')}
          disabled={busy !== null}
          fullWidth
          data-testid="add-more-cards-btn"
        >
          Add another card
        </Button>
        <Button
          variant="contained"
          onClick={() => run('finish')}
          disabled={busy !== null}
          fullWidth
          data-testid="finish-setup-btn"
        >
          {busy === 'finish' ? 'Finishing...' : "That's all of them"}
        </Button>
      </Stack>
    </CardShell>
  );
};
