import React, { useState } from 'react';
import { AxiosError } from 'axios';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  TextField
} from '@mui/material';
import { bankAccountsApi } from '../../services/api';
import { SUPPORTED_BANKS } from '../../constants/banks';
import { track, BANK_ACCOUNT_EVENTS } from '../../utils/analytics';

interface BankAccountFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const BankAccountForm: React.FC<BankAccountFormProps> = ({
  open,
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    bankId: '',
    name: '',
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSelectChange = (e: SelectChangeEvent) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name || '']: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    track(BANK_ACCOUNT_EVENTS.START_ADD, {
      bankId: formData.bankId,
      bankName: SUPPORTED_BANKS.find(bank => bank.id === formData.bankId)?.name
    });

    try {
    await bankAccountsApi.add({
        bankId: formData.bankId,
        name: formData.name,
        credentials: {
          username: formData.username,
          password: formData.password
        }
      });

      track(BANK_ACCOUNT_EVENTS.ADD_SUCCESS, {
        bankId: formData.bankId,
        bankName: SUPPORTED_BANKS.find(bank => bank.id === formData.bankId)?.name
      });

      resetForm();
      onSuccess();
      onClose();
    } catch (err) {
      // Extract error message from axios error response
      const errorMessage = err instanceof AxiosError
        ? err.response?.data?.error || 'Failed to add bank account'
        : 'Failed to add bank account';
      setError(errorMessage);
      track(BANK_ACCOUNT_EVENTS.ADD_ERROR, {
        bankId: formData.bankId,
        error: errorMessage
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      bankId: '',
      name: '',
      username: '',
      password: ''
    });
    setError('');
  };

  // Reset form when modal is opened
  React.useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open]);

  const handleDialogClose = () => {
    track(BANK_ACCOUNT_EVENTS.CLOSE_ADD_FORM);
    resetForm();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleDialogClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Bank Account</DialogTitle>
      <DialogContent>
        <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
          <FormControl fullWidth margin="normal">
            <InputLabel>Bank</InputLabel>
            <Select
              name="bankId"
              value={formData.bankId}
              onChange={handleSelectChange}
              required
            >
              {SUPPORTED_BANKS.map(bank => (
                <MenuItem key={bank.id} value={bank.id}>
                  {bank.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            margin="normal"
            label="Account Name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
            helperText="Enter a name to identify this account (e.g. 'Main Checking')"
          />

          <TextField
            fullWidth
            margin="normal"
            label="Username"
            name="username"
            value={formData.username}
            onChange={handleInputChange}
            required
          />

          <TextField
            fullWidth
            margin="normal"
            label="Password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleInputChange}
            required
          />

          {error && <FormHelperText error>{error}</FormHelperText>}
        </form>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleDialogClose}>Cancel</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          color="primary"
          disabled={loading}
        >
          Add Account
        </Button>
      </DialogActions>
    </Dialog>
  );
};
