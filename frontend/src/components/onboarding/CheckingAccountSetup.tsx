import React, { useState } from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  FormHelperText,
  Alert,
  SelectChangeEvent
} from '@mui/material';
import { AxiosError } from 'axios';
import { CHECKING_ACCOUNT_BANKS } from '../../constants/banks';
import { track } from '../../utils/analytics';
import { BANK_ACCOUNT_EVENTS } from '../../constants/analytics';
import { OnboardingStepProps } from './OnboardingWizard';

export interface CheckingAccountSetupProps extends OnboardingStepProps {
  onConnect: (bankId: string, credentials: any, displayName?: string) => Promise<any>;
}

export const CheckingAccountSetup: React.FC<CheckingAccountSetupProps> = ({
  onConnect,
  onComplete,
  onBack
}) => {
  const [formData, setFormData] = useState({
    bankId: '',
    name: 'Main Checking',
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

    // Validate form
    if (!formData.bankId || !formData.name || !formData.username || !formData.password) {
      setError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    try {
      track(BANK_ACCOUNT_EVENTS.ADD, {
        bankId: formData.bankId,
        bankName: CHECKING_ACCOUNT_BANKS.find(bank => bank.id === formData.bankId)?.name,
        isOnboarding: true
      });

      // Use the new onConnect method from the wizard
      await onConnect(
        formData.bankId,
        {
          username: formData.username,
          password: formData.password
        },
        formData.name
      );

      track(BANK_ACCOUNT_EVENTS.ADD_SUCCESS, {
        bankId: formData.bankId,
        bankName: CHECKING_ACCOUNT_BANKS.find(bank => bank.id === formData.bankId)?.name,
        isOnboarding: true
      });

      // Call onComplete to trigger status refresh
      if (onComplete) {
        onComplete();
      }

    } catch (err) {
      const errorMessage = err instanceof AxiosError
        ? err.response?.data?.error || 'Failed to connect bank account'
        : 'Failed to connect bank account';
      
      setError(errorMessage);
      
      track(BANK_ACCOUNT_EVENTS.ADD_ERROR, {
        bankId: formData.bankId,
        error: errorMessage,
        isOnboarding: true
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box data-testid="checking-account-setup">
      <Box sx={{ mb: 3, textAlign: 'center' }}>
        <Typography variant="h5" component="h2" gutterBottom data-testid="checking-account-title">
          Connect Your Main Checking Account
        </Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          Start by connecting your primary bank account. We'll import 6 months of transaction history 
          to give you a complete financial overview.
        </Typography>
      </Box>

      <form onSubmit={handleSubmit}>
        <FormControl fullWidth margin="normal" required>
          <InputLabel>Select Your Bank</InputLabel>
          <Select
            name="bankId"
            value={formData.bankId}
            onChange={handleSelectChange}
            label="Select Your Bank"
            data-testid="bank-select"
          >
            {CHECKING_ACCOUNT_BANKS.map(bank => (
              <MenuItem key={bank.id} value={bank.id}>
                {bank.name}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>
            Only Israeli checking account banks are shown. Credit cards will be added in the next step.
          </FormHelperText>
        </FormControl>

        <TextField
          fullWidth
          margin="normal"
          label="Account Name"
          name="name"
          value={formData.name}
          onChange={handleInputChange}
          required
          helperText="We suggest 'Main Checking' - you can change this later"
          placeholder="Main Checking"
          data-testid="display-name-input"
        />

        <TextField
          fullWidth
          margin="normal"
          label="Username"
          name="username"
          value={formData.username}
          onChange={handleInputChange}
          required
          helperText="Your online banking username"
          data-testid="username-input"
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
          helperText="Your online banking password"
          data-testid="password-input"
        />

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
          {onBack && (
            <Button 
              onClick={onBack}
              disabled={loading}
            >
              Back
            </Button>
          )}
          
          <Button 
            type="submit"
            variant="contained" 
            size="large"
            disabled={loading}
            sx={{ ml: 'auto' }}
            data-testid="connect-checking-btn"
          >
            {loading ? 'Connecting...' : 'Connect Account'}
          </Button>
        </Box>
      </form>

      {/* Information Section */}
      <Box sx={{ mt: 4, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
        <Typography variant="subtitle2" gutterBottom>
          🔒 Your credentials are secure
        </Typography>
        <Typography variant="body2" color="text.secondary">
          We use bank-grade encryption to protect your information. Your credentials are never stored 
          in plain text and are only used to fetch your transaction data.
        </Typography>
      </Box>

      <Box sx={{ mt: 2, p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
        <Typography variant="subtitle2" gutterBottom>
          📊 What happens next?
        </Typography>
        <Typography variant="body2" color="text.secondary">
          After connecting, we'll import the last 6 months of transactions and automatically categorize 
          them using our AI system. This usually takes 1-2 minutes.
        </Typography>
      </Box>
    </Box>
  );
};
