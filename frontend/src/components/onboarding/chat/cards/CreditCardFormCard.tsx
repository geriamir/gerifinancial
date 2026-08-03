import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Alert,
  Stack,
  Typography
} from '@mui/material';
import { Lock as LockIcon } from '@mui/icons-material';
import { AxiosError } from 'axios';
import { CREDIT_CARD_PROVIDERS } from '../../../../constants/banks';
import { BankPicker } from '../../../bank/BankPicker';
import { CardShell } from '../CardShell';
import { CardProps } from '../types';

export const CreditCardFormCard: React.FC<CardProps> = ({ handlers }) => {
  const [form, setForm] = useState({ bankId: '', username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState('');

  const handleText = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleProvider = (bankId: string) => {
    setForm((previous) => ({ ...previous, bankId }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!form.bankId || !form.username || !form.password) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const provider = CREDIT_CARD_PROVIDERS.find((candidate) => candidate.id === form.bankId);
      await handlers.connectCreditCardAccount(
        form.bankId,
        { username: form.username, password: form.password },
        `${provider?.name || form.bankId} Credit Cards`
      );
    } catch (err) {
      setError(
        err instanceof AxiosError
          ? err.response?.data?.error || 'Failed to connect credit card provider'
          : 'Failed to connect credit card provider'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setSkipping(true);
    try {
      await handlers.skipCreditCards();
    } finally {
      setSkipping(false);
    }
  };

  const busy = loading || skipping;

  return (
    <CardShell testId="credit-card-setup">
      <form onSubmit={handleSubmit}>
        <BankPicker
          banks={CREDIT_CARD_PROVIDERS}
          value={form.bankId}
          onChange={handleProvider}
          label="Card provider"
          helperText="Whoever issues the card, which is not always the bank you just connected."
          testId="provider-select"
        />

        <TextField
          fullWidth
          margin="dense"
          size="small"
          label="Username"
          name="username"
          value={form.username}
          onChange={handleText}
          required
          data-testid="cc-username-input"
        />

        <TextField
          fullWidth
          margin="dense"
          size="small"
          label="Password"
          name="password"
          type="password"
          value={form.password}
          onChange={handleText}
          required
          data-testid="cc-password-input"
        />

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
          <LockIcon fontSize="small" color="disabled" />
          <Typography variant="caption" color="text.secondary">
            Stored the same way as your bank login - encrypted, never in plain text.
          </Typography>
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
          <Button type="submit" variant="contained" disabled={busy} fullWidth data-testid="connect-cards-btn">
            {loading ? 'Connecting...' : 'Connect'}
          </Button>
          <Button variant="outlined" onClick={handleSkip} disabled={busy} fullWidth data-testid="skip-cards-btn">
            Skip for now
          </Button>
        </Stack>
      </form>
    </CardShell>
  );
};
