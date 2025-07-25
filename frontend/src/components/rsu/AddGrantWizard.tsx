import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stepper,
  Step,
  StepLabel,
  TextField,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Divider,
  Chip
} from '@mui/material';
import {
  Business as BusinessIcon,
  CalendarToday as CalendarIcon,
  AttachMoney as MoneyIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useRSU } from '../../contexts/RSUContext';

interface AddGrantWizardProps {
  open: boolean;
  onClose: () => void;
}

interface GrantFormData {
  stockSymbol: string;
  name: string;
  company: string;
  grantDate: Date | null;
  totalValue: string;
  totalShares: string;
  notes: string;
}

interface VestingPreview {
  period: number;
  date: string;
  shares: number;
}

const steps = [
  'Grant Details',
  'Vesting Preview',
  'Confirmation'
];

const AddGrantWizard: React.FC<AddGrantWizardProps> = ({
  open,
  onClose
}) => {
  const { createGrant, loading } = useRSU();
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<GrantFormData>({
    stockSymbol: '',
    name: '',
    company: '',
    grantDate: null,
    totalValue: '',
    totalShares: '',
    notes: ''
  });

  const [vestingPreview, setVestingPreview] = useState<VestingPreview[]>([]);
  const firstInputRef = React.useRef<HTMLInputElement>(null);
  const vestingPreviewRef = React.useRef<HTMLDivElement>(null);
  const confirmationRef = React.useRef<HTMLDivElement>(null);

  // Reset form when dialog opens/closes, but preserve state on error
  React.useEffect(() => {
    if (!open) {
      // When dialog closes, reset everything regardless of error state
      // This ensures clean state for next opening
      setTimeout(() => {
        setActiveStep(0);
        setError(null);
        setSubmitting(false);
        setFormData({
          stockSymbol: '',
          name: '',
          company: '',
          grantDate: null,
          totalValue: '',
          totalShares: '',
          notes: ''
        });
        setVestingPreview([]);
      }, 200); // Small delay to avoid visual glitch
    } else if (open && activeStep === 0) {
      // Focus the first input when dialog opens
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 100);
    } else if (open && activeStep === 1) {
      // Focus the vesting preview container when navigating to step 1
      setTimeout(() => {
        vestingPreviewRef.current?.focus();
      }, 100);
    } else if (open && activeStep === 2) {
      // Focus the confirmation container when navigating to step 2
      setTimeout(() => {
        confirmationRef.current?.focus();
      }, 100);
    }
  }, [open, activeStep]);

  const handleInputChange = (field: keyof GrantFormData) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setError(null);
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handleDateChange = (date: Date | null) => {
    setError(null);
    setFormData(prev => ({
      ...prev,
      grantDate: date
    }));
  };

  const generateVestingPreview = () => {
    const { grantDate, totalShares } = formData;
    if (!grantDate || !totalShares) return [];

    const shares = parseInt(totalShares);
    if (isNaN(shares) || shares <= 0) return [];

    const periods = 20; // 5 years × 4 quarters
    const baseShares = Math.floor(shares / periods);
    const remainder = shares % periods;

    const preview: VestingPreview[] = [];
    
    for (let i = 0; i < periods; i++) {
      const sharesThisPeriod = i < remainder ? baseShares + 1 : baseShares;
      const vestDate = new Date(grantDate);
      vestDate.setMonth(vestDate.getMonth() + (i + 1) * 3); // Add quarters
      
      preview.push({
        period: i + 1,
        date: vestDate.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }),
        shares: sharesThisPeriod
      });
    }

    return preview;
  };

  const validateStep = (step: number): string | null => {
    switch (step) {
      case 0:
        if (!formData.stockSymbol.trim()) return 'Stock symbol is required';
        if (!formData.grantDate) return 'Grant date is required';
        if (!formData.totalValue.trim()) return 'Total value is required';
        if (!formData.totalShares.trim()) return 'Total shares is required';
        
        const value = parseFloat(formData.totalValue);
        const shares = parseInt(formData.totalShares);
        
        if (isNaN(value) || value <= 0) return 'Total value must be a positive number';
        if (isNaN(shares) || shares <= 0) return 'Total shares must be a positive number';
        
        return null;
      default:
        return null;
    }
  };

  const handleNext = () => {
    const validationError = validateStep(activeStep);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (activeStep === 0) {
      // Generate vesting preview when moving from step 0 to step 1
      setVestingPreview(generateVestingPreview());
    }

    setActiveStep(prev => prev + 1);
    setError(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      
      if (activeStep === steps.length - 1) {
        // Last step - submit the form
        handleSubmit();
      } else {
        // Navigate to next step
        handleNext();
      }
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
    setError(null);
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      const grantData = {
        stockSymbol: formData.stockSymbol.toUpperCase().trim(),
        name: formData.name.trim() || undefined,
        company: formData.company.trim() || undefined,
        grantDate: formData.grantDate!.toISOString(),
        totalValue: parseFloat(formData.totalValue),
        totalShares: parseInt(formData.totalShares),
        notes: formData.notes.trim() || undefined
      };

      await createGrant(grantData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create grant');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ py: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              fullWidth
              label="Grant Name (Optional)"
              value={formData.name}
              onChange={handleInputChange('name')}
              placeholder="e.g., Q2 2024 Grant, Initial Offer"
              helperText="Custom name to identify this grant (optional)"
              inputRef={firstInputRef}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                label="Stock Symbol"
                value={formData.stockSymbol}
                onChange={handleInputChange('stockSymbol')}
                placeholder="e.g., MSFT, AAPL, GOOGL"
                helperText="Enter the stock ticker symbol"
                inputProps={{ style: { textTransform: 'uppercase' } }}
              />
              <TextField
                fullWidth
                label="Company Name (Optional)"
                value={formData.company}
                onChange={handleInputChange('company')}
                placeholder="e.g., Microsoft Corporation"
                helperText="Company name for display purposes (optional)"
              />
            </Box>
            <DatePicker
              label="Grant Date"
              value={formData.grantDate}
              onChange={handleDateChange}
              format="dd/MM/yyyy"
              slotProps={{
                textField: {
                  fullWidth: true,
                  helperText: 'Date when RSUs were granted to you'
                }
              }}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                label="Total Value (USD)"
                value={formData.totalValue}
                onChange={handleInputChange('totalValue')}
                placeholder="50000"
                helperText="Total grant value at grant date"
                type="number"
                inputProps={{ min: 0, step: 0.01 }}
              />
              <TextField
                fullWidth
                label="Total Shares"
                value={formData.totalShares}
                onChange={handleInputChange('totalShares')}
                placeholder="1000"
                helperText="Number of shares granted"
                type="number"
                inputProps={{ min: 1, step: 1 }}
              />
            </Box>
            <TextField
              fullWidth
              label="Notes (Optional)"
              value={formData.notes}
              onChange={handleInputChange('notes')}
              placeholder="Additional information about this grant..."
              multiline
              rows={3}
            />
          </Box>
        );

      case 1:
        const totalValue = parseFloat(formData.totalValue) || 0;
        const totalShares = parseInt(formData.totalShares) || 0;
        const pricePerShare = totalShares > 0 ? totalValue / totalShares : 0;

        return (
          <Box 
            sx={{ py: 2 }}
            tabIndex={0}
            ref={vestingPreviewRef}
          >
            <Typography variant="h6" gutterBottom>
              Vesting Schedule Preview
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Your RSUs will vest quarterly over 5 years (20 periods). Here's the calculated schedule:
            </Typography>

            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Price per Share
                    </Typography>
                    <Typography variant="h6">
                      ${pricePerShare.toFixed(2)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Vesting Period
                    </Typography>
                    <Typography variant="h6">
                      5 years (quarterly)
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>

            <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
              {vestingPreview.slice(0, 8).map((period, index) => (
                <Box
                  key={period.period}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    py: 1,
                    px: 2,
                    bgcolor: index % 2 === 0 ? 'action.hover' : 'transparent',
                    borderRadius: 1,
                    mb: 0.5
                  }}
                >
                  <Box>
                    <Typography variant="body2">
                      Period {period.period}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {period.date}
                    </Typography>
                  </Box>
                  <Chip
                    label={`${period.shares.toLocaleString()} shares`}
                    size="small"
                    variant="outlined"
                  />
                </Box>
              ))}
              {vestingPreview.length > 8 && (
                <Typography variant="caption" color="text.secondary" sx={{ px: 2 }}>
                  ... and {vestingPreview.length - 8} more periods
                </Typography>
              )}
            </Box>
          </Box>
        );

      case 2:
        return (
          <Box 
            sx={{ py: 2 }}
            tabIndex={0}
            ref={confirmationRef}
          >
            <Typography variant="h6" gutterBottom>
              Confirm Grant Details
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Please review your grant information before creating:
            </Typography>

            <Card variant="outlined">
              <CardContent>
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <BusinessIcon color="primary" />
                    <Typography variant="h6">
                      {formData.stockSymbol}{formData.company ? ` • ${formData.company}` : ''}
                    </Typography>
                  </Box>
                </Box>
                
                <Box sx={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, 1fr)', 
                  gap: 2,
                  mb: 2
                }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Grant Date
                    </Typography>
                    <Typography variant="body1">
                      {formData.grantDate?.toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Total Value
                    </Typography>
                    <Typography variant="body1">
                      ${parseFloat(formData.totalValue).toLocaleString()}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Total Shares
                    </Typography>
                    <Typography variant="body1">
                      {parseInt(formData.totalShares).toLocaleString()}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Price per Share
                    </Typography>
                    <Typography variant="body1">
                      ${(parseFloat(formData.totalValue) / parseInt(formData.totalShares)).toFixed(2)}
                    </Typography>
                  </Box>
                </Box>
                
                {formData.notes && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Notes
                      </Typography>
                      <Typography variant="body1">
                        {formData.notes}
                      </Typography>
                    </Box>
                  </>
                )}
              </CardContent>
            </Card>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: 600 }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Add RSU Grant
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 400 }}>
            Press Enter to continue
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label, index) => (
            <Step key={label}>
              <StepLabel>
                {label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onKeyDown={handleKeyDown}>
          {renderStepContent(activeStep)}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          disabled={activeStep === 0 || submitting}
          onClick={handleBack}
        >
          Back
        </Button>
        {activeStep === steps.length - 1 ? (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={20} /> : null}
          >
            {submitting ? 'Creating...' : 'Create Grant'}
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={submitting}
          >
            Next
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default AddGrantWizard;
