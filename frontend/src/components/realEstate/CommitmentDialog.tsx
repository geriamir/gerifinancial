import React, { useState, useEffect } from 'react';
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
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { Commitment } from '../../services/api/realEstate';
import { SUPPORTED_CURRENCIES } from '../../types/foreignCurrency';

interface CommitmentDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Commitment>) => Promise<void>;
  commitment?: Commitment | null;
}

const CommitmentDialog: React.FC<CommitmentDialogProps> = ({
  open,
  onClose,
  onSave,
  commitment
}) => {
  const [formData, setFormData] = useState({
    description: '',
    amount: 0,
    currency: 'USD',
    dueDate: new Date(),
    notes: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isEditing = !!commitment;

  useEffect(() => {
    if (open && commitment) {
      setFormData({
        description: commitment.description || '',
        amount: commitment.amount || 0,
        currency: commitment.currency || 'USD',
        dueDate: commitment.dueDate ? new Date(commitment.dueDate) : new Date(),
        notes: commitment.notes || ''
      });
    } else if (open) {
      setFormData({
        description: '',
        amount: 0,
        currency: 'USD',
        dueDate: new Date(),
        notes: ''
      });
    }
    setErrors({});
    setSubmitError(null);
  }, [open, commitment]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }
    if (!formData.amount || formData.amount <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }
    if (!formData.dueDate) {
      newErrors.dueDate = 'Due date is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    try {
      setIsSubmitting(true);
      setSubmitError(null);
      await onSave({
        description: formData.description,
        amount: formData.amount,
        currency: formData.currency,
        dueDate: formData.dueDate.toISOString(),
        notes: formData.notes || undefined
      });
      onClose();
    } catch (error: any) {
      setSubmitError(error?.response?.data?.message || 'Failed to save commitment');
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
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            {isEditing ? 'Edit Commitment' : 'Add Commitment'}
          </Typography>
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
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            error={!!errors.description}
            helperText={errors.description}
            disabled={isSubmitting}
            required
          />

          <Box display="flex" gap={2}>
            <TextField
              fullWidth
              label="Amount"
              type="number"
              value={formData.amount || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
              error={!!errors.amount}
              helperText={errors.amount}
              disabled={isSubmitting}
              required
              inputProps={{ min: 0, step: 0.01 }}
            />

            <FormControl sx={{ minWidth: 120 }} disabled={isSubmitting}>
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

          <DatePicker
            label="Due Date"
            value={formData.dueDate}
            onChange={(date) => {
              if (date) setFormData(prev => ({ ...prev, dueDate: date }));
            }}
            disabled={isSubmitting}
            slotProps={{
              textField: {
                fullWidth: true,
                error: !!errors.dueDate,
                helperText: errors.dueDate,
                required: true
              }
            }}
          />

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
          {isSubmitting ? 'Saving...' : isEditing ? 'Update' : 'Add Commitment'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CommitmentDialog;
