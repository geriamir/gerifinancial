import React, { useEffect, useState } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { AxiosError } from 'axios';
import { OnboardingStatus } from '../../../../services/api/onboarding';
import { ChatHandlers } from '../types';

interface FailedCardAccountActionsProps {
  account: NonNullable<OnboardingStatus['creditCardMatching']['failedAccount']>;
  handlers: ChatHandlers;
}

type Mode = 'summary' | 'repair' | 'remove';

const apiErrorMessage = (error: unknown): string => {
  if (error instanceof AxiosError) {
    return error.response?.data?.details
      || error.response?.data?.error
      || 'Failed to update the card account';
  }
  return error instanceof Error ? error.message : 'Failed to update the card account';
};

export const FailedCardAccountActions: React.FC<FailedCardAccountActionsProps> = ({
  account,
  handlers
}) => {
  const [mode, setMode] = useState<Mode>('summary');
  const [form, setForm] = useState({ username: '', password: '', card6Digits: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isIsracard = account.bankId === 'isracard';

  useEffect(() => {
    setMode('summary');
    setForm({ username: '', password: '', card6Digits: '' });
    setError('');
  }, [account.accountId]);

  const handleText = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: name === 'card6Digits' ? value.replace(/\D/g, '').slice(0, 6) : value
    }));
  };

  const repair = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!form.username || !form.password) {
      setError('Please enter the username and new password');
      return;
    }
    if (isIsracard && !/^\d{6}$/.test(form.card6Digits)) {
      setError('Enter the last 6 digits of your Isracard');
      return;
    }

    setBusy(true);
    try {
      await handlers.repairCreditCardAccount(account.accountId, {
        username: form.username,
        password: form.password,
        ...(isIsracard && { card6Digits: form.card6Digits })
      });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      await handlers.removeCreditCardAccount(account.accountId);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ mb: 2 }} data-testid="failed-card-account">
      <Alert severity="error">
        <AlertTitle>{account.displayName} needs attention</AlertTitle>
        {account.error}
      </Alert>

      {mode === 'summary' && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }}>
          <Button
            variant="contained"
            onClick={() => setMode('repair')}
            data-testid="fix-card-account-btn"
          >
            Fix account
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={() => setMode('remove')}
            data-testid="remove-card-account-btn"
          >
            Remove account
          </Button>
        </Stack>
      )}

      {mode === 'repair' && (
        <Box component="form" onSubmit={repair} sx={{ mt: 1.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Enter the credentials for {account.displayName}. They will be validated before the import retries.
          </Typography>
          <TextField
            fullWidth
            margin="dense"
            size="small"
            label={isIsracard ? 'ID Number' : 'Username'}
            name="username"
            value={form.username}
            onChange={handleText}
            disabled={busy}
            required
            inputProps={{ 'data-testid': 'repair-card-username' }}
          />
          {isIsracard && (
            <TextField
              fullWidth
              margin="dense"
              size="small"
              label="Last 6 card digits"
              name="card6Digits"
              value={form.card6Digits}
              onChange={handleText}
              disabled={busy}
              required
              inputProps={{
                inputMode: 'numeric',
                pattern: '[0-9]{6}',
                maxLength: 6,
                'data-testid': 'repair-card6-digits'
              }}
            />
          )}
          <TextField
            fullWidth
            margin="dense"
            size="small"
            label="New password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleText}
            disabled={busy}
            required
            inputProps={{ 'data-testid': 'repair-card-password' }}
          />
          {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
            <Button type="submit" variant="contained" disabled={busy}>
              {busy ? 'Checking...' : 'Save and retry'}
            </Button>
            <Button onClick={() => setMode('summary')} disabled={busy}>
              Cancel
            </Button>
          </Stack>
        </Box>
      )}

      {mode === 'remove' && (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="body2">
            Remove this connection from GeriFinancial?
          </Typography>
          {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
            <Button
              variant="contained"
              color="error"
              onClick={remove}
              disabled={busy}
              data-testid="confirm-remove-card-account-btn"
            >
              {busy ? 'Removing...' : 'Remove account'}
            </Button>
            <Button onClick={() => setMode('summary')} disabled={busy}>
              Cancel
            </Button>
          </Stack>
        </Box>
      )}
    </Box>
  );
};
