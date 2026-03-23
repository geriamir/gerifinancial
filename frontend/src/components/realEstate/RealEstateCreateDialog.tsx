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
  Alert
} from '@mui/material';
import { Close as CloseIcon, Save as SaveIcon } from '@mui/icons-material';
import { RealEstateInvestment } from '../../services/api/realEstate';
import { realEstateApi } from '../../services/api/realEstate';
import { SUPPORTED_CURRENCIES } from '../../types/foreignCurrency';

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
    totalInvestment: 0,
    estimatedCurrentValue: 0,
    notes: ''
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
        totalInvestment: 0,
        estimatedCurrentValue: 0,
        notes: ''
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
    if (formData.totalInvestment < 0) {
      newErrors.totalInvestment = 'Total investment cannot be negative';
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
      const investment = await realEstateApi.create({
        name: formData.name,
        type: formData.type,
        address: formData.address || undefined,
        description: formData.description || undefined,
        currency: formData.currency,
        totalInvestment: formData.totalInvestment,
        estimatedCurrentValue: formData.estimatedCurrentValue,
        notes: formData.notes || undefined
      });
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

          <Box display="flex" gap={2}>
            <TextField
              fullWidth
              label="Total Investment"
              type="number"
              value={formData.totalInvestment || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, totalInvestment: parseFloat(e.target.value) || 0 }))}
              error={!!errors.totalInvestment}
              helperText={errors.totalInvestment}
              disabled={isSubmitting}
              inputProps={{ min: 0, step: 0.01 }}
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
          </Box>

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
