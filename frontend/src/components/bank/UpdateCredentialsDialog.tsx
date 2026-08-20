import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Alert,
  CircularProgress,
  Typography,
  Box
} from '@mui/material';
import { BankAccount } from '../../services/api/types';
import { bankAccountsApi } from '../../services/api/bank';
import {
  card6DigitsProviderName,
  requiresCard6Digits
} from '../../constants/banks';

interface UpdateCredentialsDialogProps {
  open: boolean;
  account: BankAccount | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const UpdateCredentialsDialog: React.FC<UpdateCredentialsDialogProps> = ({
  open,
  account,
  onClose,
  onSuccess
}) => {
  const [password, setPassword] = useState('');
  const [card6Digits, setCard6Digits] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [flexToken, setFlexToken] = useState('');
  const [queryId, setQueryId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const isMercury = account?.bankId === 'mercury';
  const isIbkr = account?.bankId === 'ibkr';
  const needsCard6Digits = requiresCard6Digits(account?.bankId || '');
  const cardProviderName = card6DigitsProviderName(account?.bankId || '');

  const handleClose = () => {
    if (!loading) {
      setPassword('');
      setCard6Digits('');
      setApiToken('');
      setFlexToken('');
      setQueryId('');
      setError('');
      setSuccess(false);
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!account) return;
    
    if (isMercury) {
      if (!apiToken) {
        setError('API token is required');
        return;
      }
    } else if (isIbkr) {
      if (!flexToken || !queryId) {
        setError('Flex token and Query ID are required');
        return;
      }
    } else {
      if (!password) {
        setError('Password is required');
        return;
      }
      if (needsCard6Digits && !/^\d{6}$/.test(card6Digits)) {
        setError(`Enter the last 6 digits of your ${cardProviderName}`);
        return;
      }
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      if (isMercury) {
        await bankAccountsApi.updateCredentials(account._id, {
          apiToken
        });
      } else if (isIbkr) {
        await bankAccountsApi.updateCredentials(account._id, {
          flexToken,
          queryId
        });
      } else {
        const username = account.credentials?.username || '';
        if (!username) {
          setError('Unable to retrieve account username');
          setLoading(false);
          return;
        }
        await bankAccountsApi.updateCredentials(account._id, {
          username,
          password,
          ...(needsCard6Digits && { card6Digits })
        });
      }
      
      setSuccess(true);
      setError('');
      
      setTimeout(() => {
        handleClose();
        onSuccess();
      }, 1500);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update credentials';
      setError(errorMessage);
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  if (!account) return null;

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          Update Bank Credentials
        </DialogTitle>
        
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Updating credentials for: <strong>{account.name}</strong>
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Bank: {account.bankId}
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" onClose={() => setError('')}>
                {error}
              </Alert>
            )}

            {success && (
              <Alert severity="success">
                Credentials updated successfully! The account will be automatically tested.
              </Alert>
            )}

            {isMercury ? (
              <TextField
                label="API Token"
                type="password"
                fullWidth
                required
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                disabled={loading || success}
                placeholder="Enter your Mercury API token"
                helperText="Generate a new token from your Mercury dashboard"
              />
            ) : isIbkr ? (
              <>
                <TextField
                  label="Flex Web Service Token"
                  type="password"
                  fullWidth
                  required
                  value={flexToken}
                  onChange={(e) => setFlexToken(e.target.value)}
                  disabled={loading || success}
                  helperText="Your token from IBKR Settings → Flex Web Service"
                />
                <TextField
                  label="Flex Query ID"
                  fullWidth
                  required
                  value={queryId}
                  onChange={(e) => setQueryId(e.target.value)}
                  disabled={loading || success}
                  helperText="The numeric ID of your Activity Flex Query"
                />
              </>
            ) : (
              <>
                <TextField
                  label={needsCard6Digits ? 'ID Number' : 'Username'}
                  type="text"
                  fullWidth
                  value={account.credentials?.username || 'N/A'}
                  disabled
                  helperText={`${needsCard6Digits ? 'ID number' : 'Username'} cannot be changed. Create a new account if needed.`}
                />

                {needsCard6Digits && (
                  <TextField
                    label="Last 6 card digits"
                    fullWidth
                    required
                    value={card6Digits}
                    onChange={(e) => setCard6Digits(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    disabled={loading || success}
                    inputProps={{ inputMode: 'numeric', pattern: '[0-9]{6}', maxLength: 6 }}
                    helperText={`The last 6 digits of any ${cardProviderName} card registered to this ID`}
                  />
                )}

                <TextField
                  label="Password"
                  type="password"
                  fullWidth
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading || success}
                  autoComplete="current-password"
                  placeholder="Enter your bank password"
                />
              </>
            )}

            <Alert severity="info" sx={{ mt: 1 }}>
              {isMercury
                ? 'Your API token will be encrypted and stored securely.'
                : isIbkr
                  ? 'Your Flex token will be encrypted and the updated connection will be synced automatically.'
                : 'Your credentials will be validated with the bank before saving. The connection will be tested automatically.'}
            </Alert>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button 
            onClick={handleClose} 
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={
              loading ||
              success ||
              (isMercury
                ? !apiToken
                : isIbkr
                  ? !flexToken || !queryId
                  : !password || (needsCard6Digits && card6Digits.length !== 6))
            }
            startIcon={loading && <CircularProgress size={16} />}
          >
            {loading
              ? 'Updating...'
              : isMercury
                ? 'Update Token'
                : isIbkr
                  ? 'Update Flex Credentials'
                  : 'Update Password'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
