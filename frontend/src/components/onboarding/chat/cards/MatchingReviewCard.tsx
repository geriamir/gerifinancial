import React, { useState } from 'react';
import { Box, Button, Typography, Stack, LinearProgress, Chip } from '@mui/material';
import { Add as AddIcon, CreditCard as CreditCardIcon } from '@mui/icons-material';
import { CardShell } from '../CardShell';
import { CardProps } from '../types';

/**
 * Shown once the card statements have been matched against the payments in the
 * checking account. Finishing is always allowed: partial coverage usually means
 * a card the user genuinely does not have, and blocking on it would strand them.
 */
export const MatchingReviewCard: React.FC<CardProps> = ({ status, handlers }) => {
  const [busy, setBusy] = useState<'more' | 'finish' | null>(null);
  const matching = status.creditCardMatching;
  const cards = matching?.connectedCreditCards || [];
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

      {cards.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {cards.map((card) => (
            <Chip key={card.id} icon={<CreditCardIcon />} label={card.displayName} size="small" />
          ))}
        </Stack>
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
