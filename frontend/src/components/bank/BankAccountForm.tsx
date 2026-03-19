import React, { useState } from 'react';
import { AxiosError } from 'axios';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  InputLabel,
  Link,
  MenuItem,
  Select,
  SelectChangeEvent,
  TextField,
  Typography
} from '@mui/material';
import { bankAccountsApi } from '../../services/api/bank';
import { SUPPORTED_BANKS, isApiBank } from '../../constants/banks';
import { track } from '../../utils/analytics';
import { BANK_ACCOUNT_EVENTS } from '../../constants/analytics';

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
    password: '',
    apiToken: '',
    flexToken: '',
    queryId: ''
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

    track(BANK_ACCOUNT_EVENTS.ADD, {
      bankId: formData.bankId,
      bankName: SUPPORTED_BANKS.find(bank => bank.id === formData.bankId)?.name
    });

    try {
      let credentials;
      if (formData.bankId === 'ibkr') {
        credentials = { flexToken: formData.flexToken, queryId: formData.queryId };
      } else if (isApiBank(formData.bankId)) {
        credentials = { apiToken: formData.apiToken };
      } else {
        credentials = { username: formData.username, password: formData.password };
      }

      await bankAccountsApi.add({
        bankId: formData.bankId,
        name: formData.name,
        credentials
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
      password: '',
      apiToken: '',
      flexToken: '',
      queryId: ''
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

          {formData.bankId === 'ibkr' ? (
            <>
              <Alert severity="info" sx={{ mt: 2, mb: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  How to set up IBKR Flex Query
                </Typography>
                <Typography variant="body2" gutterBottom>
                  A <strong>Flex Query</strong> is an IBKR reporting feature that lets you export account data (positions, trades, dividends, etc.) via API.
                  Each user must create their own token and query — but the query configuration below is the same for everyone.
                </Typography>
                <Box component="ol" sx={{ pl: 2, mb: 1, '& li': { mb: 0.5 } }}>
                  <Typography component="li" variant="body2">
                    Log in to <Link href="https://www.interactivebrokers.com/sso/Login" target="_blank" rel="noopener">IBKR Account Management</Link> (Client Portal).
                  </Typography>
                  <Typography component="li" variant="body2">
                    <strong>Create the token:</strong> Go to <em>Settings → Flex Web Service</em> and generate a new token. Copy it below.
                  </Typography>
                  <Typography component="li" variant="body2">
                    <strong>Create the query:</strong> Go to <em>Reports / Tax Reports → Flex Queries → Activity Flex Query</em> and click <strong>Create</strong>.
                  </Typography>
                  <Typography component="li" variant="body2">
                    In the query editor, enable these sections: <strong>Account Information</strong>, <strong>Open Positions</strong>, <strong>Trades</strong>, <strong>Cash Transactions</strong>, and <strong>Equity Summary</strong>. Leave the period as <em>Last 365 days</em> and format as <em>XML</em>.
                  </Typography>
                  <Typography component="li" variant="body2">
                    Save the query and copy the <strong>Query ID</strong> shown next to it.
                  </Typography>
                </Box>
              </Alert>
              <TextField
                fullWidth
                margin="normal"
                label="Flex Web Service Token"
                name="flexToken"
                type="password"
                value={formData.flexToken}
                onChange={handleInputChange}
                required
                helperText="Your personal token from Settings → Flex Web Service"
              />
              <TextField
                fullWidth
                margin="normal"
                label="Flex Query ID"
                name="queryId"
                value={formData.queryId}
                onChange={handleInputChange}
                required
                helperText="The numeric ID shown next to your Activity Flex Query"
              />
            </>
          ): isApiBank(formData.bankId) ? (
            <TextField
              fullWidth
              margin="normal"
              label="API Token"
              name="apiToken"
              type="password"
              value={formData.apiToken}
              onChange={handleInputChange}
              required
              helperText="Generate an API token from your Mercury dashboard"
            />
          ) : (
            <>
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
            </>
          )}

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
