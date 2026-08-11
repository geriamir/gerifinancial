import React, { useState } from 'react';
import { Box, Button, Typography, Stack, Divider } from '@mui/material';
import { CreditCard as CreditCardIcon } from '@mui/icons-material';
import { CardShell } from '../CardShell';
import { CardProps } from '../types';
import { providerNames, providerSuggestionsFor } from '../providerSuggestions';

/**
 * A branch in the conversation. Both options are phrased as something the user
 * would say, because whichever they pick gets echoed back as their reply.
 */
export const CreditCardChoiceCard: React.FC<CardProps> = ({ status, handlers }) => {
  const [busy, setBusy] = useState<'connect' | 'skip' | null>(null);
  const detection = status.creditCardDetection;
  const samples = detection?.sampleTransactions || [];
  const hiddenPaymentCount = Math.max(0, (detection?.transactionCount || 0) - samples.length);
  const providerSuggestions = providerSuggestionsFor(detection);

  const choose = async (choice: 'connect' | 'skip') => {
    setBusy(choice);
    try {
      await (choice === 'connect' ? handlers.proceedToCreditCardSetup() : handlers.skipCreditCards());
    } finally {
      setBusy(null);
    }
  };

  return (
    <CardShell testId="credit-card-choice">
      {samples.length > 0 && (
        <>
          <Typography variant="caption" color="text.secondary">
            Payments I spotted
          </Typography>
          <Stack spacing={0.5} sx={{ mt: 1, mb: 2 }}>
            {samples.map((transaction, index) => (
              <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                  {transaction.description}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  &#8362;{Math.abs(transaction.amount).toLocaleString()}
                </Typography>
              </Box>
            ))}
            {hiddenPaymentCount > 0 && (
              <Typography variant="caption" color="text.secondary">
                +{hiddenPaymentCount.toLocaleString()} more
              </Typography>
            )}
          </Stack>
        </>
      )}

      {providerSuggestions.length > 0 && (
        <Box sx={{ p: 1.5, mb: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
          <Typography variant="caption" color="text.secondary">
            Suggested provider{providerSuggestions.length === 1 ? '' : 's'}
          </Typography>
          <Typography variant="body2" fontWeight={600}>
            {providerNames(providerSuggestions)}
          </Typography>
        </Box>
      )}

      {(samples.length > 0 || providerSuggestions.length > 0) && <Divider sx={{ mb: 2 }} />}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button
          variant="contained"
          startIcon={<CreditCardIcon />}
          onClick={() => choose('connect')}
          disabled={busy !== null}
          fullWidth
        >
          Let's connect them
        </Button>
        <Button
          variant="outlined"
          onClick={() => choose('skip')}
          disabled={busy !== null}
          fullWidth
          data-testid="skip-cards-btn"
        >
          Skip for now
        </Button>
      </Stack>
    </CardShell>
  );
};
