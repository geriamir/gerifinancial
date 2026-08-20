import React, { useEffect, useState } from 'react';
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
import { providerSuggestionsFor } from '../providerSuggestions';

const suggestedNameFor = (status: CardProps['status'], bankId: string) => {
  const provider = CREDIT_CARD_PROVIDERS.find((candidate) => candidate.id === bankId);
  const existingCount = status.creditCardSetup?.creditCardAccounts
    ?.filter((account) => account.bankId === bankId).length || 0;
  return `${provider?.name || bankId} account ${existingCount + 1}`;
};

export const CreditCardFormCard: React.FC<CardProps> = ({ status, handlers }) => {
  const suggestedProvider = providerSuggestionsFor(status.creditCardDetection)[0];
  const [form, setForm] = useState({
    bankId: suggestedProvider?.bankId || '',
    accountName: suggestedProvider?.bankId
      ? suggestedNameFor(status, suggestedProvider.bankId)
      : '',
    username: '',
    password: '',
    card6Digits: ''
  });
  const [loading, setLoading] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!suggestedProvider?.bankId) return;
    setForm((previous) =>
      previous.bankId
        ? previous
        : {
            ...previous,
            bankId: suggestedProvider.bankId,
            accountName: suggestedNameFor(status, suggestedProvider.bankId)
          }
    );
  }, [suggestedProvider?.bankId, status]);

  const handleText = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: name === 'card6Digits' ? value.replace(/\D/g, '').slice(0, 6) : value
    }));
  };

  const handleProvider = (bankId: string) => {
    setForm((previous) => ({
      ...previous,
      bankId,
      accountName: suggestedNameFor(status, bankId)
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!form.bankId || !form.accountName.trim() || !form.username || !form.password) {
      setError('Please fill in all required fields');
      return;
    }
    if (form.bankId === 'isracard' && !/^\d{6}$/.test(form.card6Digits)) {
      setError('Enter the last 6 digits of your Isracard');
      return;
    }

    setLoading(true);
    try {
      await handlers.connectCreditCardAccount(
        form.bankId,
        {
          username: form.username,
          password: form.password,
          ...(form.bankId === 'isracard' && { card6Digits: form.card6Digits })
        },
        form.accountName.trim()
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
      <form onSubmit={handleSubmit} noValidate>
        <BankPicker
          banks={CREDIT_CARD_PROVIDERS}
          value={form.bankId}
          onChange={handleProvider}
          label="Card provider"
          helperText={
            suggestedProvider
              ? `${suggestedProvider.name} was suggested from your bank statement. Choose another if needed.`
              : 'Whoever issues the card, which is not always the bank you just connected.'
          }
          testId="provider-select"
        />

        <TextField
          fullWidth
          margin="dense"
          size="small"
          label="Account name"
          name="accountName"
          value={form.accountName}
          onChange={handleText}
          required
          helperText="Give this connection a name you will recognize. You can change it later."
          data-testid="cc-account-name-input"
        />

        <TextField
          fullWidth
          margin="dense"
          size="small"
          label={form.bankId === 'isracard' ? 'ID Number' : 'Username'}
          name="username"
          value={form.username}
          onChange={handleText}
          required
          data-testid="cc-username-input"
        />

        {form.bankId === 'isracard' && (
          <TextField
            fullWidth
            margin="dense"
            size="small"
            label="Last 6 card digits"
            name="card6Digits"
            value={form.card6Digits}
            onChange={handleText}
            required
            inputProps={{ inputMode: 'numeric', pattern: '[0-9]{6}', maxLength: 6 }}
            helperText="The last 6 digits of any Isracard registered to this ID"
            data-testid="cc-card6-input"
          />
        )}

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
