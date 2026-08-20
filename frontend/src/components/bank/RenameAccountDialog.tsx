import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField
} from '@mui/material';
import axios from 'axios';
import { bankAccountsApi } from '../../services/api/bank';
import { BankAccount } from '../../services/api/types';

interface RenameAccountDialogProps {
  open: boolean;
  account: BankAccount | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const RenameAccountDialog: React.FC<RenameAccountDialogProps> = ({
  open,
  account,
  onClose,
  onSuccess
}) => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && account) {
      setName(account.name);
      setError('');
    }
  }, [account, open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!account) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Account name is required');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await bankAccountsApi.update(account._id, { name: trimmedName });
      onSuccess();
      onClose();
    } catch (err) {
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.error || 'Failed to rename account'
          : 'Failed to rename account'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Rename account</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Account name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={loading}
            required
            helperText="Use a name you will recognize, such as Personal CAL or Family CAL."
          />
          {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={loading || name.trim() === account?.name}>
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
