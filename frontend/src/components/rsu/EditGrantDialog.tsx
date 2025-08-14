import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
  CircularProgress,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Chip
} from '@mui/material';
import {
  Close as CloseIcon,
  Edit as EditIcon,
  Schedule as ScheduleIcon,
  Preview as PreviewIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers';
import { RSUGrant, CreateGrantData, VestingPlan, VestingPlanChangePreview, vestingApi } from '../../services/api/rsus';
import { useRSU } from '../../contexts/RSUContext';

interface EditGrantDialogProps {
  open: boolean;
  grant: RSUGrant | null;
  onClose: () => void;
}

const EditGrantDialog: React.FC<EditGrantDialogProps> = ({
  open,
  grant,
  onClose
}) => {
  const { updateGrant } = useRSU();
  
  // Form state
  const [formData, setFormData] = useState<CreateGrantData>({
    stockSymbol: '',
    name: '',
    company: '',
    grantDate: '',
    totalValue: 0,
    totalShares: 0,
    notes: ''
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Vesting plan state
  const [vestingPlans, setVestingPlans] = useState<VestingPlan[]>([]);
  const [selectedVestingPlan, setSelectedVestingPlan] = useState<string>('');
  const [originalVestingPlan, setOriginalVestingPlan] = useState<string>('');
  const [vestingPlanPreview, setVestingPlanPreview] = useState<VestingPlanChangePreview | null>(null);
  const [showVestingPreview, setShowVestingPreview] = useState(false);
  const [vestingPlanChanging, setVestingPlanChanging] = useState(false);
  const [vestingPlanError, setVestingPlanError] = useState<string>('');

  // Load vesting plans on mount
  useEffect(() => {
    const loadVestingPlans = async () => {
      try {
        const plans = await vestingApi.getPlans();
        setVestingPlans(plans);
      } catch (error) {
        console.error('Error loading vesting plans:', error);
        setVestingPlanError('Failed to load vesting plans');
      }
    };

    if (open) {
      loadVestingPlans();
    }
  }, [open]);

  // Reset form when grant changes
  useEffect(() => {
    if (grant) {
      const initialVestingPlan = grant.vestingPlan || 'quarterly-5yr';
      setFormData({
        stockSymbol: grant.stockSymbol,
        name: grant.name || '',
        company: grant.company || '',
        grantDate: grant.grantDate,
        totalValue: grant.totalValue,
        totalShares: grant.totalShares,
        notes: grant.notes || ''
      });
      setSelectedVestingPlan(initialVestingPlan);
      setOriginalVestingPlan(initialVestingPlan);
      setErrors({});
      setSubmitError('');
      setVestingPlanError('');
      setVestingPlanPreview(null);
      setShowVestingPreview(false);
    }
  }, [grant]);

  const handleInputChange = (field: keyof CreateGrantData) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value;
    setFormData(prev => ({
      ...prev,
      [field]: field === 'totalValue' || field === 'totalShares' 
        ? value === '' ? 0 : Number(value)
        : value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleDateChange = (date: Date | null) => {
    if (date) {
      setFormData(prev => ({
        ...prev,
        grantDate: date.toISOString()
      }));
      
      if (errors.grantDate) {
        setErrors(prev => ({ ...prev, grantDate: '' }));
      }
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.stockSymbol.trim()) {
      newErrors.stockSymbol = 'Stock symbol is required';
    } else if (!/^[A-Z]{1,10}$/.test(formData.stockSymbol.trim().toUpperCase())) {
      newErrors.stockSymbol = 'Stock symbol must be 1-10 uppercase letters';
    }

    if (!formData.grantDate) {
      newErrors.grantDate = 'Grant date is required';
    }

    if (formData.totalValue <= 0) {
      newErrors.totalValue = 'Total value must be greater than 0';
    }

    if (formData.totalShares <= 0) {
      newErrors.totalShares = 'Total shares must be greater than 0';
    }

    if (formData.notes && formData.notes.length > 500) {
      newErrors.notes = 'Notes must be 500 characters or less';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!grant || !validateForm()) return;

    setSubmitting(true);
    setSubmitError('');

    try {
      // Check if vesting plan has changed
      const vestingPlanChanged = selectedVestingPlan !== originalVestingPlan;

      // Prepare update data - only include changed fields
      const updateData: Partial<CreateGrantData> = {};
      
      if (formData.stockSymbol !== grant.stockSymbol) {
        updateData.stockSymbol = formData.stockSymbol.trim().toUpperCase();
      }
      if (formData.name !== (grant.name || '')) {
        updateData.name = formData.name?.trim() || undefined;
      }
      if (formData.company !== (grant.company || '')) {
        updateData.company = formData.company?.trim() || undefined;
      }
      if (formData.grantDate !== grant.grantDate) {
        updateData.grantDate = formData.grantDate;
      }
      if (formData.totalValue !== grant.totalValue) {
        updateData.totalValue = formData.totalValue;
      }
      if (formData.totalShares !== grant.totalShares) {
        updateData.totalShares = formData.totalShares;
      }
      if (formData.notes !== (grant.notes || '')) {
        updateData.notes = formData.notes?.trim() || undefined;
      }

      // Handle vesting plan change if needed
      if (vestingPlanChanged) {
        await vestingApi.changePlan(grant._id, selectedVestingPlan);
      }

      // Handle basic field updates if there are any changes
      if (Object.keys(updateData).length > 0) {
        await updateGrant(grant._id, updateData);
      }

      // Close dialog if there were any changes
      if (Object.keys(updateData).length > 0 || vestingPlanChanged) {
        onClose();
      } else {
        onClose(); // No changes, just close
      }
    } catch (error) {
      console.error('Error updating grant:', error);
      setSubmitError(error instanceof Error ? error.message : 'Failed to update grant');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVestingPlanChange = async (newPlanType: string) => {
    if (!grant || newPlanType === selectedVestingPlan) return;

    setSelectedVestingPlan(newPlanType);
    setVestingPlanError('');
    
    // Show preview if plan changed from original
    if (newPlanType !== originalVestingPlan && grant.unvestedShares > 0) {
      try {
        setVestingPlanChanging(true);
        const preview = await vestingApi.previewPlanChange(grant._id, newPlanType);
        setVestingPlanPreview(preview);
        setShowVestingPreview(true);
      } catch (error) {
        console.error('Error previewing vesting plan change:', error);
        setVestingPlanError(error instanceof Error ? error.message : 'Failed to preview vesting plan change');
      } finally {
        setVestingPlanChanging(false);
      }
    } else {
      // Hide preview if back to original plan
      setVestingPlanPreview(null);
      setShowVestingPreview(false);
    }
  };

  const handleClose = () => {
    if (!submitting && !vestingPlanChanging) {
      onClose();
    }
  };

  if (!grant) return null;

  const pricePerShare = formData.totalShares > 0 ? formData.totalValue / formData.totalShares : 0;

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: 500 }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        pb: 1
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EditIcon color="primary" />
          <Typography variant="h6">
            Edit RSU Grant
          </Typography>
        </Box>
        <IconButton onClick={handleClose} disabled={submitting}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ pt: 1 }}>
          {submitError && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {submitError}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* First Row - Stock Symbol and Grant Name */}
            <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
              <TextField
                label="Stock Symbol"
                value={formData.stockSymbol}
                onChange={handleInputChange('stockSymbol')}
                error={!!errors.stockSymbol}
                helperText={errors.stockSymbol || 'e.g., MSFT, AAPL'}
                fullWidth
                required
                disabled={submitting}
                inputProps={{ 
                  style: { textTransform: 'uppercase' },
                  maxLength: 10
                }}
              />
              <TextField
                label="Grant Name"
                value={formData.name}
                onChange={handleInputChange('name')}
                error={!!errors.name}
                helperText={errors.name || 'Optional: Custom name for this grant'}
                fullWidth
                disabled={submitting}
                inputProps={{ maxLength: 100 }}
              />
            </Box>

            {/* Company Name */}
            <TextField
              label="Company Name"
              value={formData.company}
              onChange={handleInputChange('company')}
              error={!!errors.company}
              helperText={errors.company || 'Optional: Company name'}
              fullWidth
              disabled={submitting}
              inputProps={{ maxLength: 100 }}
            />

            {/* Second Row - Grant Date and Total Value */}
            <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
              <DatePicker
                label="Grant Date"
                value={formData.grantDate ? new Date(formData.grantDate) : null}
                onChange={handleDateChange}
                disabled={submitting}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    required: true,
                    error: !!errors.grantDate,
                    helperText: errors.grantDate
                  }
                }}
              />
              <TextField
                label="Total Value (USD)"
                type="number"
                value={formData.totalValue || ''}
                onChange={handleInputChange('totalValue')}
                error={!!errors.totalValue}
                helperText={errors.totalValue || 'Total USD value at grant'}
                fullWidth
                required
                disabled={submitting}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Box>

            {/* Third Row - Total Shares and Price Per Share */}
            <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
              <TextField
                label="Total Shares"
                type="number"
                value={formData.totalShares || ''}
                onChange={handleInputChange('totalShares')}
                error={!!errors.totalShares}
                helperText={errors.totalShares || 'Number of shares granted'}
                fullWidth
                required
                disabled={submitting}
                inputProps={{ min: 1, step: 1 }}
              />
              <TextField
                label="Price Per Share (Calculated)"
                value={pricePerShare ? `$${pricePerShare.toFixed(2)}` : '$0.00'}
                fullWidth
                disabled
                helperText="Automatically calculated from total value ÷ total shares"
              />
            </Box>

            {/* Notes */}
            <TextField
              label="Notes"
              value={formData.notes}
              onChange={handleInputChange('notes')}
              error={!!errors.notes}
              helperText={errors.notes || 'Optional notes about this grant'}
              fullWidth
              multiline
              rows={3}
              disabled={submitting}
              inputProps={{ maxLength: 500 }}
            />

            {/* Vesting Plan Section */}
            <Divider sx={{ my: 2 }} />
            
            <Box>
              <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <ScheduleIcon color="primary" />
                Vesting Schedule
              </Typography>

              {vestingPlanError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {vestingPlanError}
                </Alert>
              )}

              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexDirection: { xs: 'column', sm: 'row' } }}>
                <FormControl fullWidth>
                  <InputLabel>Vesting Plan</InputLabel>
                  <Select
                    value={selectedVestingPlan}
                    onChange={(e) => handleVestingPlanChange(e.target.value)}
                    disabled={submitting || vestingPlanChanging || vestingPlans.length === 0}
                    label="Vesting Plan"
                  >
                    {vestingPlans.map((plan) => (
                      <MenuItem key={plan.id} value={plan.id}>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {plan.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {plan.description}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {grant?.unvestedShares > 0 && (
                  <Box sx={{ minWidth: 200 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Current Plan
                    </Typography>
                    <Chip 
                      label={vestingPlans.find(p => p.id === selectedVestingPlan)?.name || 'Loading...'}
                      size="small" 
                      color="primary"
                      variant="outlined"
                    />
                  </Box>
                )}
              </Box>

              {vestingPlanChanging && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
                  <CircularProgress size={16} />
                  <Typography variant="body2" color="text.secondary">
                    Analyzing vesting plan change...
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Vesting Plan Change Preview */}
            {showVestingPreview && vestingPlanPreview && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'info.main', color: 'info.contrastText', borderRadius: 1, opacity: 0.9 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PreviewIcon />
                  Vesting Plan Change Preview
                </Typography>

                {!vestingPlanPreview.canChange ? (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      <strong>Cannot change vesting plan:</strong> {vestingPlanPreview.reason}
                    </Typography>
                  </Alert>
                ) : (
                  <>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>From:</strong> {vestingPlanPreview.currentPlan.name} → <strong>To:</strong> {vestingPlanPreview.newPlan.name}
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        • Vested shares remain unchanged: <strong>{vestingPlanPreview.impact.vestedSharesUnchanged.toLocaleString()}</strong>
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        • Unvested shares will be redistributed: <strong>{vestingPlanPreview.impact.unvestedShares.toLocaleString()}</strong>
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        • Schedule will change from <strong>{vestingPlanPreview.impact.periodsKept}</strong> to <strong>{vestingPlanPreview.impact.newPeriods}</strong> periods
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ opacity: 0.8 }}>
                      This change will be applied when you click "Update Grant" below.
                    </Typography>
                  </>
                )}
              </Box>
            )}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button 
          onClick={handleClose} 
          disabled={submitting}
          variant="outlined"
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit}
          disabled={submitting}
          variant="contained"
          startIcon={submitting ? <CircularProgress size={16} /> : <EditIcon />}
        >
          {submitting ? 'Updating...' : 'Update Grant'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditGrantDialog;
