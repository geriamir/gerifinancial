import React, { useState } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  FormHelperText,
  Alert,
  Typography,
  SelectChangeEvent
} from '@mui/material';
import { Lock as LockIcon } from '@mui/icons-material';
import { AxiosError } from 'axios';
import { CHECKING_ACCOUNT_BANKS } from '../../../../constants/banks';
import { BankIcon } from '../../../bank/BankIcon';
import { track } from '../../../../utils/analytics';
import { BANK_ACCOUNT_EVENTS } from '../../../../constants/analytics';
import { CardShell } from '../CardShell';
import { CardProps } from '../types';

export const CheckingAccountCard: React.FC<CardProps> = ({ handlers }) => {
  const [form, setForm] = useState({ bankId: '', name: 'Main Checking', username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const bankNameOf = (bankId: string) => CHECKING_ACCOUNT_BANKS.find((bank) => bank.id === bankId)?.name;

  const handleText = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSelect = (event: SelectChangeEvent) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name || '']: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!form.bankId || !form.name || !form.username || !form.password) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      track(BANK_ACCOUNT_EVENTS.ADD, {
        bankId: form.bankId,
        bankName: bankNameOf(form.bankId),
        isOnboarding: true
      });

      await handlers.connectCheckingAccount(
        form.bankId,
        { username: form.username, password: form.password },
        form.name
      );

      track(BANK_ACCOUNT_EVENTS.ADD_SUCCESS, {
        bankId: form.bankId,
        bankName: bankNameOf(form.bankId),
        isOnboarding: true
      });
    } catch (err) {
      const message =
        err instanceof AxiosError
          ? err.response?.data?.error || 'Failed to connect bank account'
          : 'Failed to connect bank account';
      setError(message);
      track(BANK_ACCOUNT_EVENTS.ADD_ERROR, {
        bankId: form.bankId,
        error: message,
        isOnboarding: true
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <CardShell testId="checking-account-setup">
      <form onSubmit={handleSubmit}>
        <FormControl fullWidth margin="dense" required size="small">
          <InputLabel id="checking-bank-label">Your bank</InputLabel>
          <Select
            labelId="checking-bank-label"
            id="checking-bank-select"
            name="bankId"
            value={form.bankId}
            onChange={handleSelect}
            label="Your bank"
            data-testid="bank-select"
            sx={{ '& .MuiSelect-select': { display: 'flex', alignItems: 'center', gap: 1.5 } }}
          >
            {CHECKING_ACCOUNT_BANKS.map((bank) => (
              <MenuItem key={bank.id} value={bank.id} sx={{ gap: 1.5 }}>
                <BankIcon bankId={bank.id} size={24} />
                {bank.name}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>Credit cards come later - this is your day-to-day account.</FormHelperText>
        </FormControl>

        <TextField
          fullWidth
          margin="dense"
          size="small"
          label="Call it"
          name="name"
          value={form.name}
          onChange={handleText}
          required
          helperText="You can rename it later."
          data-testid="display-name-input"
        />

        <TextField
          fullWidth
          margin="dense"
          size="small"
          label="Online banking username"
          name="username"
          value={form.username}
          onChange={handleText}
          required
          data-testid="username-input"
        />

        <TextField
          fullWidth
          margin="dense"
          size="small"
          label="Online banking password"
          name="password"
          type="password"
          value={form.password}
          onChange={handleText}
          required
          data-testid="password-input"
        />

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
          <LockIcon fontSize="small" color="disabled" />
          <Typography variant="caption" color="text.secondary">
            Encrypted with a key only your account can unlock. Never stored in plain text.
          </Typography>
        </Box>

        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={loading}
          sx={{ mt: 2 }}
          data-testid="connect-checking-btn"
        >
          {loading ? 'Connecting...' : 'Connect account'}
        </Button>
      </form>
    </CardShell>
  );
};
