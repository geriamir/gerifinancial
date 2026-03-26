import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Box,
  Typography,
  IconButton,
  Alert,
  Divider,
  Chip
} from '@mui/material';
import { Close as CloseIcon, Save as SaveIcon } from '@mui/icons-material';
import { RealEstateInvestment } from '../../services/api/realEstate';
import { realEstateApi } from '../../services/api/realEstate';
import { SUPPORTED_CURRENCIES, formatCurrency } from '../../types/foreignCurrency';

interface RealEstateCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (investment: RealEstateInvestment) => void;
}

const RealEstateCreateDialog: React.FC<RealEstateCreateDialogProps> = ({
  open,
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    name: '',
    type: 'flip' as 'flip' | 'rental',
    address: '',
    description: '',
    currency: 'USD',
    estimatedCurrentValue: 0,
    notes: '',
    // Rental estimation
    estimatedMonthlyRental: 0,
    mortgagePercentage: 0,
    mortgageInterestRate: 0,
    mortgageTermYears: 25
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setFormData({
        name: '',
        type: 'flip',
        address: '',
        description: '',
        currency: 'USD',
        estimatedCurrentValue: 0,
        notes: '',
        estimatedMonthlyRental: 0,
        mortgagePercentage: 0,
        mortgageInterestRate: 0,
        mortgageTermYears: 25
      });
      setErrors({});
      setSubmitError(null);
      setTimeout(() => nameRef.current?.focus(), 300);
    }
  }, [open]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.type) {
      newErrors.type = 'Type is required';
    }
    if (formData.estimatedCurrentValue < 0) {
      newErrors.estimatedCurrentValue = 'Estimated value cannot be negative';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    try {
      setIsSubmitting(true);
      setSubmitError(null);
      const createData: Partial<any> = {
        name: formData.name,
        type: formData.type,
        address: formData.address || undefined,
        description: formData.description || undefined,
        currency: formData.currency,
        estimatedCurrentValue: formData.estimatedCurrentValue,
        notes: formData.notes || undefined
      };

      if (formData.type === 'rental') {
        if (formData.estimatedMonthlyRental) createData.estimatedMonthlyRental = formData.estimatedMonthlyRental;
        if (formData.mortgagePercentage) createData.mortgagePercentage = formData.mortgagePercentage;
        if (formData.mortgageInterestRate) createData.mortgageInterestRate = formData.mortgageInterestRate;
        if (formData.mortgageTermYears) createData.mortgageTermYears = formData.mortgageTermYears;
      }

      const investment = await realEstateApi.create(createData);
      onSuccess(investment);
      onClose();
    } catch (error: any) {
      setSubmitError(error?.response?.data?.message || 'Failed to create investment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      TransitionProps={{
        onEntered: () => {
          setTimeout(() => nameRef.current?.focus(), 50);
        }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">New Real Estate Investment</Typography>
          <IconButton onClick={handleClose} disabled={isSubmitting} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2.5} mt={1}>
          {submitError && <Alert severity="error">{submitError}</Alert>}

          <TextField
            fullWidth
            label="Investment Name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            error={!!errors.name}
            helperText={errors.name || 'e.g., "123 Main St Flip" or "Downtown Rental"'}
            disabled={isSubmitting}
            inputRef={nameRef}
            required
          />

          <Box display="flex" gap={2}>
            <FormControl fullWidth required error={!!errors.type} disabled={isSubmitting}>
              <InputLabel>Type</InputLabel>
              <Select
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'flip' | 'rental' }))}
                label="Type"
              >
                <MenuItem value="flip">Flip</MenuItem>
                <MenuItem value="rental">Rental</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth disabled={isSubmitting}>
              <InputLabel>Currency</InputLabel>
              <Select
                value={formData.currency}
                onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                label="Currency"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <MenuItem key={c.code} value={c.code}>
                    {c.code} ({c.symbol})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <TextField
            fullWidth
            label="Address"
            value={formData.address}
            onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
            disabled={isSubmitting}
          />

          <TextField
            fullWidth
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            disabled={isSubmitting}
            multiline
            rows={2}
          />

          <TextField
            fullWidth
            label="Estimated Current Value"
            type="number"
            value={formData.estimatedCurrentValue || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, estimatedCurrentValue: parseFloat(e.target.value) || 0 }))}
            error={!!errors.estimatedCurrentValue}
            helperText={errors.estimatedCurrentValue}
            disabled={isSubmitting}
            inputProps={{ min: 0, step: 0.01 }}
          />

          {formData.type === 'rental' && (
            <>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle1" fontWeight="bold">
                Rental & Financing Estimates <Chip label="Rental" size="small" color="secondary" sx={{ ml: 1 }} />
              </Typography>
              <TextField
                fullWidth
                label="Estimated Monthly Rental"
                type="number"
                value={formData.estimatedMonthlyRental || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, estimatedMonthlyRental: parseFloat(e.target.value) || 0 }))}
                helperText="Expected monthly rental income"
                disabled={isSubmitting}
                inputProps={{ min: 0, step: 0.01 }}
              />
              <Box display="flex" gap={2}>
                <TextField
                  fullWidth
                  label="Mortgage %"
                  type="number"
                  value={formData.mortgagePercentage || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, mortgagePercentage: parseFloat(e.target.value) || 0 }))}
                  helperText="% of property value financed"
                  disabled={isSubmitting}
                  inputProps={{ min: 0, max: 100, step: 0.1 }}
                />
                <TextField
                  fullWidth
                  label="Interest Rate (%)"
                  type="number"
                  value={formData.mortgageInterestRate || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, mortgageInterestRate: parseFloat(e.target.value) || 0 }))}
                  helperText="Annual interest rate"
                  disabled={isSubmitting}
                  inputProps={{ min: 0, max: 100, step: 0.01 }}
                />
                <TextField
                  fullWidth
                  label="Term (Years)"
                  type="number"
                  value={formData.mortgageTermYears || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, mortgageTermYears: parseFloat(e.target.value) || 0 }))}
                  disabled={isSubmitting}
                  inputProps={{ min: 1, max: 50, step: 1 }}
                />
              </Box>
              {formData.mortgagePercentage > 0 && formData.estimatedCurrentValue > 0 && (
                <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Mortgage Amount: {formatCurrency(formData.estimatedCurrentValue * (formData.mortgagePercentage / 100), formData.currency)}
                    {formData.mortgageInterestRate > 0 && formData.mortgageTermYears > 0 && (() => {
                      const principal = formData.estimatedCurrentValue * (formData.mortgagePercentage / 100);
                      const monthlyRate = (formData.mortgageInterestRate / 100) / 12;
                      const n = formData.mortgageTermYears * 12;
                      const payment = (principal * monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
                      return ` | Est. Monthly Payment: ${formatCurrency(payment, formData.currency)}`;
                    })()}
                  </Typography>
                  {formData.estimatedMonthlyRental > 0 && formData.mortgageInterestRate > 0 && formData.mortgageTermYears > 0 && (() => {
                    const principal = formData.estimatedCurrentValue * (formData.mortgagePercentage / 100);
                    const monthlyRate = (formData.mortgageInterestRate / 100) / 12;
                    const n = formData.mortgageTermYears * 12;
                    const payment = (principal * monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
                    const netIncome = formData.estimatedMonthlyRental - payment;
                    return (
                      <Typography variant="body2" color={netIncome >= 0 ? 'success.main' : 'error.main'} fontWeight="bold">
                        Net Monthly Cash Flow: {netIncome >= 0 ? '+' : ''}{formatCurrency(netIncome, formData.currency)}
                      </Typography>
                    );
                  })()}
                </Box>
              )}
            </>
          )}

          <TextField
            fullWidth
            label="Notes"
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            disabled={isSubmitting}
            multiline
            rows={3}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isSubmitting}
          endIcon={<SaveIcon />}
        >
          {isSubmitting ? 'Creating...' : 'Create Investment'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RealEstateCreateDialog;
