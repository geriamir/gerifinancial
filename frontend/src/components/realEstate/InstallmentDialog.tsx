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
  Alert,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  ToggleButtonGroup,
  ToggleButton,
  InputAdornment,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  LinkOff as UnlinkIcon,
  Add as AddIcon,
  Percent as PercentIcon,
  AttachMoney as AmountIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { Installment } from '../../services/api/realEstate';
import { SUPPORTED_CURRENCIES, formatCurrency } from '../../types/foreignCurrency';

const INSTALLMENT_TYPES: { value: Installment['installmentType']; label: string }[] = [
  { value: 'investment', label: 'Investment' },
  { value: 'tax', label: 'Tax' },
  { value: 'lawyer', label: 'Lawyer' },
  { value: 'other', label: 'Other' }
];

interface InstallmentDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Installment>) => Promise<void>;
  installment?: Installment | null;
  estimatedCurrentValue?: number;
  currency?: string;
  purchaseTaxRate?: number | null;
  transactions?: any[];
  onLinkTransaction?: (installmentId: string, transactionId: string) => Promise<void>;
  onUnlinkTransaction?: (installmentId: string, transactionId: string) => Promise<void>;
}

const InstallmentDialog: React.FC<InstallmentDialogProps> = ({
  open,
  onClose,
  onSave,
  installment,
  estimatedCurrentValue = 0,
  currency: investmentCurrency = 'USD',
  purchaseTaxRate: defaultTaxRate = 0,
  transactions = [],
  onLinkTransaction,
  onUnlinkTransaction
}) => {
  const [formData, setFormData] = useState({
    description: '',
    installmentType: 'investment' as Installment['installmentType'],
    amount: 0,
    percentage: null as number | null,
    includeTax: false,
    taxPercentage: null as number | null,
    currency: 'USD',
    dueDate: new Date(),
    notes: ''
  });
  const percentageTypeDefault = (type: string) => type !== 'other';
  const [usePercentage, setUsePercentage] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showTransactionPicker, setShowTransactionPicker] = useState(false);

  const isEditing = !!installment;

  useEffect(() => {
    if (open && installment) {
      const hasPercentage = installment.percentage != null && installment.percentage > 0;
      setUsePercentage(hasPercentage || percentageTypeDefault(installment.installmentType || 'investment'));
      setFormData({
        description: installment.description || '',
        installmentType: installment.installmentType || 'investment',
        amount: installment.amount || 0,
        percentage: installment.percentage ?? null,
        includeTax: installment.includeTax || false,
        taxPercentage: installment.taxPercentage ?? (defaultTaxRate || null),
        currency: installment.currency || investmentCurrency,
        dueDate: installment.dueDate ? new Date(installment.dueDate) : new Date(),
        notes: installment.notes || ''
      });
    } else if (open) {
      setUsePercentage(true);
      setFormData({
        description: '',
        installmentType: 'investment',
        amount: 0,
        percentage: null,
        includeTax: false,
        taxPercentage: defaultTaxRate || null,
        currency: investmentCurrency,
        dueDate: new Date(),
        notes: ''
      });
    }
    setErrors({});
    setSubmitError(null);
    setShowTransactionPicker(false);
  }, [open, installment, investmentCurrency, defaultTaxRate]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }
    if (usePercentage) {
      if (!formData.percentage || formData.percentage <= 0 || formData.percentage > 100) {
        newErrors.percentage = 'Percentage must be between 0 and 100';
      }
      if (!estimatedCurrentValue || estimatedCurrentValue <= 0) {
        newErrors.percentage = 'Property value must be set to use percentage';
      }
    } else {
      if (!formData.amount || formData.amount <= 0) {
        newErrors.amount = 'Amount must be greater than 0';
      }
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
      let amount: number;
      if (usePercentage) {
        const baseAmount = estimatedCurrentValue * ((formData.percentage || 0) / 100);
        const taxAmount = formData.includeTax && formData.taxPercentage
          ? baseAmount * (formData.taxPercentage / 100)
          : 0;
        amount = baseAmount + taxAmount;
      } else {
        amount = formData.amount;
      }
      await onSave({
        description: formData.description,
        installmentType: formData.installmentType,
        amount,
        percentage: usePercentage ? formData.percentage : null,
        includeTax: formData.includeTax,
        taxPercentage: formData.includeTax ? formData.taxPercentage : null,
        currency: formData.currency,
        dueDate: formData.dueDate.toISOString(),
        notes: formData.notes || undefined
      });
      onClose();
    } catch (error: any) {
      setSubmitError(error?.response?.data?.message || 'Failed to save installment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  const linkedTxIds = new Set(installment?.linkedTransactions || []);
  const linkedTxs = transactions.filter(t => linkedTxIds.has(t._id));
  const availableTxs = transactions.filter(t => !linkedTxIds.has(t._id));

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            {isEditing ? 'Edit Installment' : 'Add Installment'}
          </Typography>
          <IconButton onClick={handleClose} disabled={isSubmitting} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2.5} mt={1}>
          {submitError && <Alert severity="error">{submitError}</Alert>}

          <Box display="flex" gap={2}>
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
            <FormControl sx={{ minWidth: 150 }} disabled={isSubmitting} required>
              <InputLabel>Type</InputLabel>
              <Select
                value={formData.installmentType}
                onChange={(e) => {
                  const newType = e.target.value as Installment['installmentType'];
                  setFormData(prev => ({
                    ...prev,
                    installmentType: newType,
                    includeTax: newType !== 'investment' ? false : prev.includeTax
                  }));
                  setUsePercentage(percentageTypeDefault(newType));
                }}
                label="Type"
              >
                {INSTALLMENT_TYPES.map((t) => (
                  <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Amount Mode Toggle */}
          <Box display="flex" alignItems="center" gap={1}>
            <ToggleButtonGroup
              value={usePercentage ? 'percentage' : 'amount'}
              exclusive
              onChange={(_, val) => {
                if (val !== null) setUsePercentage(val === 'percentage');
              }}
              size="small"
              disabled={isSubmitting}
            >
              <ToggleButton value="amount">
                <AmountIcon fontSize="small" sx={{ mr: 0.5 }} /> Fixed Amount
              </ToggleButton>
              <ToggleButton value="percentage" disabled={!estimatedCurrentValue || estimatedCurrentValue <= 0}>
                <PercentIcon fontSize="small" sx={{ mr: 0.5 }} /> % of Value
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {usePercentage ? (
            <Box display="flex" flexDirection="column" gap={2}>
              <TextField
                fullWidth
                label="Percentage of Property Value"
                type="number"
                value={formData.percentage ?? ''}
                onChange={(e) => {
                  const pct = parseFloat(e.target.value) || 0;
                  setFormData(prev => ({ ...prev, percentage: pct }));
                }}
                error={!!errors.percentage}
                helperText={errors.percentage || (() => {
                  if (!formData.percentage || !estimatedCurrentValue) return undefined;
                  const base = estimatedCurrentValue * (formData.percentage / 100);
                  const tax = formData.includeTax && formData.taxPercentage
                    ? base * (formData.taxPercentage / 100)
                    : 0;
                  const total = base + tax;
                  return tax > 0
                    ? `${formatCurrency(base, investmentCurrency)} + ${formatCurrency(tax, investmentCurrency)} tax = ${formatCurrency(total, investmentCurrency)}`
                    : `= ${formatCurrency(base, investmentCurrency)}`;
                })()}
                disabled={isSubmitting}
                required
                inputProps={{ min: 0, max: 100, step: 0.1 }}
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>
                }}
              />

              {formData.installmentType === 'investment' && (
                <Box display="flex" alignItems="center" gap={1}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.includeTax}
                        onChange={(e) => setFormData(prev => ({ ...prev, includeTax: e.target.checked }))}
                        disabled={isSubmitting}
                        size="small"
                      />
                    }
                    label="Include Tax"
                  />
                  {formData.includeTax && (
                    <TextField
                      label="Tax Rate"
                      type="number"
                      value={formData.taxPercentage ?? ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, taxPercentage: parseFloat(e.target.value) || 0 }))}
                      disabled={isSubmitting}
                      inputProps={{ min: 0, max: 100, step: 0.1 }}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>
                      }}
                      size="small"
                      sx={{ width: 150 }}
                    />
                  )}
                </Box>
              )}
            </Box>
          ) : (
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
          )}

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
            rows={2}
          />

          {/* Linked Transactions (only when editing) */}
          {isEditing && installment && (
            <>
              <Divider sx={{ my: 0.5 }} />
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2" fontWeight="bold">
                  Linked Transactions ({linkedTxs.length})
                </Typography>
                {availableTxs.length > 0 && (
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => setShowTransactionPicker(!showTransactionPicker)}
                  >
                    {showTransactionPicker ? 'Hide' : 'Link Transaction'}
                  </Button>
                )}
              </Box>

              {linkedTxs.length > 0 ? (
                <List dense disablePadding>
                  {linkedTxs.map((txn) => (
                    <ListItem key={txn._id} disableGutters>
                      <ListItemText
                        primary={txn.description}
                        secondary={`${new Date(txn.date).toLocaleDateString()} · ${formatCurrency(txn.amount, txn.currency)}`}
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => onUnlinkTransaction?.(installment._id, txn._id)}
                        >
                          <UnlinkIcon fontSize="small" />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No transactions linked yet.
                </Typography>
              )}

              {showTransactionPicker && availableTxs.length > 0 && (
                <Box sx={{ maxHeight: 200, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
                  <Typography variant="caption" color="text.secondary" mb={0.5} display="block">
                    Select a transaction to link:
                  </Typography>
                  <List dense disablePadding>
                    {availableTxs.map((txn) => (
                      <ListItem
                        key={txn._id}
                        disableGutters
                        sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, borderRadius: 1, px: 1 }}
                        onClick={async () => {
                          await onLinkTransaction?.(installment._id, txn._id);
                          setShowTransactionPicker(false);
                        }}
                      >
                        <ListItemText
                          primary={txn.description}
                          secondary={`${new Date(txn.date).toLocaleDateString()} · ${formatCurrency(txn.amount, txn.currency)}`}
                        />
                        <Chip label="Link" size="small" color="primary" variant="outlined" />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </>
          )}
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
          {isSubmitting ? 'Saving...' : isEditing ? 'Update' : 'Add Installment'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InstallmentDialog;
