import React, { useEffect } from 'react';
import { Box, Button, Typography, Stack, Chip } from '@mui/material';
import {
  Dashboard as DashboardIcon,
  AccountBalance as BankIcon,
  TrendingUp as TrendingUpIcon,
  CreditCard as CreditCardIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { CardShell } from '../CardShell';
import { CardProps } from '../types';

const AUTO_REDIRECT_MS = 10000;

export const CompleteCard: React.FC<CardProps> = ({ status }) => {
  const navigate = useNavigate();
  const imported = status.transactionImport?.transactionsImported || 0;
  const cards = status.creditCardSetup?.creditCardAccounts || [];

  useEffect(() => {
    const timer = setTimeout(() => navigate('/'), AUTO_REDIRECT_MS);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <CardShell testId="onboarding-complete">
      <Typography variant="subtitle1" gutterBottom>
        Onboarding Complete
      </Typography>

      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mb: 2 }}>
        {status.checkingAccount?.connected && (
          <Chip icon={<BankIcon />} label="Checking account" color="success" size="small" />
        )}
        {imported > 0 && (
          <Chip
            icon={<TrendingUpIcon />}
            label={`${imported.toLocaleString()} transactions`}
            color="primary"
            size="small"
          />
        )}
        {cards.length > 0 && (
          <Chip
            icon={<CreditCardIcon />}
            label={`${cards.length} card${cards.length === 1 ? '' : 's'}`}
            color="success"
            size="small"
          />
        )}
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Worth doing first: skim the categories I picked and correct any that look wrong. I learn from
        those corrections, so the next import lands closer.
      </Typography>

      <Button
        variant="contained"
        fullWidth
        startIcon={<DashboardIcon />}
        onClick={() => navigate('/')}
        data-testid="go-to-dashboard-btn"
      >
        Go to Dashboard
      </Button>

      <Box sx={{ mt: 1, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          Taking you there automatically in a few seconds.
        </Typography>
      </Box>
    </CardShell>
  );
};
