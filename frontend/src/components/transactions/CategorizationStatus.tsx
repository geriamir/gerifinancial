import React, { useEffect } from 'react';
import { Alert, AlertTitle, Box, LinearProgress, Typography } from '@mui/material';
import { AutoAwesome as CategorizingIcon } from '@mui/icons-material';
import { useCategorization } from '../../contexts/CategorizationContext';

const DISMISS_AFTER_MS = 8000;

/**
 * Tells the user that freshly imported transactions are still being
 * categorised, so a list that looks half empty reads as work in progress
 * rather than as a sync that quietly went wrong.
 */
export const CategorizationStatus: React.FC = () => {
  const { active, processed, total, categorized, finished, dismiss } = useCategorization();

  useEffect(() => {
    if (!finished) return;
    const timer = setTimeout(dismiss, DISMISS_AFTER_MS);
    return () => clearTimeout(timer);
  }, [finished, dismiss]);

  if (active) {
    // A batch of unknown size would give a bar that fills and resets, which
    // reads as a stall. An indeterminate bar is honest about not knowing.
    const percent = total > 0 ? Math.round((processed / total) * 100) : undefined;

    return (
      <Box sx={{ mb: 2 }} data-testid="categorization-status">
        <Alert severity="info" icon={<CategorizingIcon />}>
          <AlertTitle>Categorising your transactions</AlertTitle>
          <Typography variant="body2" color="text.secondary">
            {total > 0
              ? `${processed} of ${total} looked at, ${categorized} categorised so far.`
              : 'Working through the transactions that just came in.'}
          </Typography>
          <LinearProgress
            variant={percent === undefined ? 'indeterminate' : 'determinate'}
            value={percent}
            data-testid="categorization-progress"
            sx={{ mt: 1, borderRadius: 1 }}
          />
        </Alert>
      </Box>
    );
  }

  // Nothing to report: render nothing at all rather than an empty wrapper, since
  // this sits above every page in the app.
  if (!finished) return null;

  const needsAttention = finished.uncategorized + finished.failed;

  return (
    <Box sx={{ mb: 2 }} data-testid="categorization-status">
      <Alert severity="success" onClose={dismiss}>
        <AlertTitle>
          Categorised {finished.categorized} of {finished.total} new transactions
        </AlertTitle>
        <Typography variant="body2" color="text.secondary">
          {needsAttention > 0
            ? `${needsAttention} still need a category - open them to tell us where they belong, and we will recognise them next time.`
            : 'Everything that came in has a category.'}
        </Typography>
      </Alert>
    </Box>
  );
};

export default CategorizationStatus;
