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
import { isApiBank } from '../../constants/banks';

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
  const [apiToken, setApiToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const isMercury = account ? isApiBank(account.bankId) : false;

  const handleClose = () => {
    if (!loading) {
      setPassword('');
      setApiToken('');
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
    } else {
      if (!password) {
        setError('Password is required');
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
      } else {
        const username = account.credentials?.username || '';
        if (!username) {
          setError('Unable to retrieve account username');
          setLoading(false);
          return;
        }
        await bankAccountsApi.updateCredentials(account._id, {
          username,
          password
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
            ) : (
              <>
                <TextField
                  label="Username"
                  type="text"
                  fullWidth
                  value={account.credentials?.username || 'N/A'}
                  disabled
                  helperText="Username cannot be changed. Create a new account if needed."
                />

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
            disabled={loading || success || (isMercury ? !apiToken : !password)}
            startIcon={loading && <CircularProgress size={16} />}
          >
            {loading ? 'Updating...' : isMercury ? 'Update Token' : 'Update Password'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
