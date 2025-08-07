import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  TextField,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Divider,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  AttachMoney as MoneyIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Calculate as CalculateIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useRSU } from '../../contexts/RSUContext';
import { RSUGrant, TaxCalculation } from '../../services/api/rsus';

interface RecordSaleFormProps {
  open: boolean;
  onClose: () => void;
  grant: RSUGrant | null;
}

interface SaleFormData {
  saleDate: Date | null;
  sharesAmount: string;
  pricePerShare: string;
  notes: string;
}

const RecordSaleForm: React.FC<RecordSaleFormProps> = ({
  open,
  onClose,
  grant
}) => {
  const { recordSale, getTaxPreview, grants, getSalesByGrant } = useRSU();
  const [selectedGrant, setSelectedGrant] = useState<RSUGrant | null>(grant);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [taxPreview, setTaxPreview] = useState<TaxCalculation | null>(null);
  const [calculatingTax, setCalculatingTax] = useState(false);

  const [formData, setFormData] = useState<SaleFormData>({
    saleDate: new Date(),
    sharesAmount: '',
    pricePerShare: '',
    notes: ''
  });

  // Reset form when dialog opens/closes or grant changes
  useEffect(() => {
    if (open) {
      setSelectedGrant(grant);
      setError(null);
      setSubmitting(false);
      setTaxPreview(null);
      setFormData({
        saleDate: new Date(),
        sharesAmount: '',
        pricePerShare: grant?.currentPrice?.toString() || '',
        notes: ''
      });
    }
  }, [open, grant]);

  // Update form when selected grant changes
  useEffect(() => {
    if (selectedGrant) {
      setFormData(prev => ({
        ...prev,
        pricePerShare: selectedGrant.currentPrice?.toString() || ''
      }));
      setTaxPreview(null);
    }
  }, [selectedGrant]);

  const handleGrantChange = (event: any) => {
    const grantId = event.target.value;
    const newGrant = grants.find(g => g._id === grantId) || null;
    setSelectedGrant(newGrant);
    setError(null);
  };

  const handleInputChange = (field: keyof SaleFormData) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setError(null);
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
    
    // Clear tax preview when inputs change
    if (field === 'sharesAmount' || field === 'pricePerShare') {
      setTaxPreview(null);
    }
  };

  const handleDateChange = (date: Date | null) => {
    setError(null);
    setFormData(prev => ({
      ...prev,
      saleDate: date
    }));
    setTaxPreview(null);
  };

  const validateForm = (): string | null => {
    if (!selectedGrant) return 'No grant selected';
    if (!formData.saleDate) return 'Sale date is required';
    if (!formData.sharesAmount.trim()) return 'Number of shares is required';
    if (!formData.pricePerShare.trim()) return 'Price per share is required';
    
    const shares = parseInt(formData.sharesAmount);
    const price = parseFloat(formData.pricePerShare);
    
    if (isNaN(shares) || shares <= 0) return 'Shares amount must be a positive number';
    if (isNaN(price) || price <= 0) return 'Price per share must be a positive number';
    
    // Calculate available shares: vested shares minus already sold shares
    const existingSales = getSalesByGrant(selectedGrant._id);
    const totalSoldShares = existingSales.reduce((sum, sale) => sum + sale.sharesAmount, 0);
    const availableShares = selectedGrant.vestedShares - totalSoldShares;
    
    if (shares > availableShares) {
      return `Cannot sell more than ${availableShares.toLocaleString()} shares (${selectedGrant.vestedShares.toLocaleString()} vested - ${totalSoldShares.toLocaleString()} already sold)`;
    }
    
    return null;
  };

  const handleCalculateTax = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setCalculatingTax(true);
      setError(null);
      
      const preview = await getTaxPreview({
        grantId: selectedGrant!._id,
        sharesAmount: parseInt(formData.sharesAmount),
        salePrice: parseFloat(formData.pricePerShare),
        saleDate: formData.saleDate?.toISOString() || new Date().toISOString()
      });
      
      setTaxPreview(preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate tax preview');
    } finally {
      setCalculatingTax(false);
    }
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const saleData = {
        grantId: selectedGrant!._id,
        saleDate: formData.saleDate!.toISOString(),
        sharesAmount: parseInt(formData.sharesAmount),
        pricePerShare: parseFloat(formData.pricePerShare),
        notes: formData.notes.trim() || undefined
      };

      await recordSale(saleData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record sale');
    } finally {
      setSubmitting(false);
    }
  };

  const totalSaleValue = parseInt(formData.sharesAmount || '0') * parseFloat(formData.pricePerShare || '0');
  const isFormValid = !validateForm();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: 500 }
      }}
    >
      <DialogTitle>
        Record RSU Sale{selectedGrant ? ` - ${selectedGrant.stockSymbol}` : ''}
      </DialogTitle>

      <DialogContent>
        {/* Grant Selection (when no grant is pre-selected) */}
        {!grant && (
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Select Grant to Sell From</InputLabel>
            <Select
              value={selectedGrant?._id || ''}
              onChange={handleGrantChange}
              label="Select Grant to Sell From"
            >
              {grants
                .filter(g => g.vestedShares > 0) // Only show grants with vested shares
                .map((g) => (
                  <MenuItem key={g._id} value={g._id}>
                    {g.stockSymbol} • {g.name || g.company} • {new Date(g.grantDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })} • {g.vestedShares.toLocaleString()} vested shares
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        )}

        {/* Grant Info */}
        {selectedGrant && (
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {selectedGrant.stockSymbol} • {selectedGrant.company}
              </Typography>
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                gap: 2 
              }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Vested Shares
                  </Typography>
                  <Typography variant="h6" color="success.main">
                    {selectedGrant.vestedShares.toLocaleString()}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Current Price
                  </Typography>
                  <Typography variant="h6">
                    ${selectedGrant.currentPrice.toFixed(2)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Grant Price
                  </Typography>
                  <Typography variant="h6">
                    ${selectedGrant.pricePerShare.toFixed(2)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Sale Form */}
        {selectedGrant && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <DatePicker
            label="Sale Date"
            value={formData.saleDate}
            onChange={handleDateChange}
            format="dd/MM/yyyy"
            slotProps={{
              textField: {
                fullWidth: true,
                helperText: 'Date when you sold the shares'
              }
            }}
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth
              label="Number of Shares"
              value={formData.sharesAmount}
              onChange={handleInputChange('sharesAmount')}
              placeholder="100"
              helperText={(() => {
                const existingSales = getSalesByGrant(selectedGrant._id);
                const totalSoldShares = existingSales.reduce((sum, sale) => sum + sale.sharesAmount, 0);
                const availableShares = selectedGrant.vestedShares - totalSoldShares;
                return totalSoldShares > 0 
                  ? `Max: ${availableShares.toLocaleString()} available (${selectedGrant.vestedShares.toLocaleString()} vested - ${totalSoldShares.toLocaleString()} sold)`
                  : `Max: ${availableShares.toLocaleString()} vested shares`;
              })()}
              type="number"
              inputProps={{ 
                min: 1, 
                max: (() => {
                  const existingSales = getSalesByGrant(selectedGrant._id);
                  const totalSoldShares = existingSales.reduce((sum, sale) => sum + sale.sharesAmount, 0);
                  return selectedGrant.vestedShares - totalSoldShares;
                })(),
                step: 1 
              }}
            />
            <TextField
              fullWidth
              label="Price per Share (USD)"
              value={formData.pricePerShare}
              onChange={handleInputChange('pricePerShare')}
              placeholder={selectedGrant.currentPrice.toFixed(2)}
              helperText="Sale price per share"
              type="number"
              inputProps={{ min: 0, step: 0.01 }}
            />
          </Box>

          {/* Sale Summary */}
          {formData.sharesAmount && formData.pricePerShare && totalSaleValue > 0 && (
            <Card variant="outlined" sx={{ bgcolor: 'action.hover' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Total Sale Value
                  </Typography>
                  <Typography variant="h5" color="primary">
                    ${totalSaleValue.toLocaleString()}
                  </Typography>
                </Box>
                <Box sx={{ mt: 1, display: 'flex', justifyContent: 'center' }}>
                  <Button
                    variant="outlined"
                    startIcon={calculatingTax ? <CircularProgress size={16} /> : <CalculateIcon />}
                    onClick={handleCalculateTax}
                    disabled={!isFormValid || calculatingTax}
                  >
                    {calculatingTax ? 'Calculating...' : 'Calculate Tax Preview'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Tax Preview */}
          {taxPreview && (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Tax Calculation Preview
                </Typography>
                
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Sale Value:</Typography>
                    <Typography variant="body1" fontWeight="medium">
                      ${((taxPreview.originalValue || 0) + (taxPreview.profit || 0)).toLocaleString()}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Original Value:</Typography>
                    <Typography variant="body1">
                      ${(taxPreview.originalValue || 0).toLocaleString()}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="body2">Profit:</Typography>
                    <Typography 
                      variant="body1"
                      color={(taxPreview.profit || 0) >= 0 ? 'success.main' : 'error.main'}
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      {(taxPreview.profit || 0) >= 0 ? <TrendingUpIcon fontSize="small" /> : <TrendingDownIcon fontSize="small" />}
                      ${(taxPreview.profit || 0).toLocaleString()}
                    </Typography>
                  </Box>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Wage Income Tax (65%):</Typography>
                    <Typography variant="body1" color="error.main">
                      ${(taxPreview.wageIncomeTax || 0).toLocaleString()}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">
                      Capital Gains Tax ({taxPreview.isLongTerm ? '25%' : '65%'}):
                    </Typography>
                    <Typography variant="body1" color="error.main">
                      ${(taxPreview.capitalGainsTax || 0).toLocaleString()}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="body1" fontWeight="medium">Total Tax:</Typography>
                    <Typography variant="body1" fontWeight="medium" color="error.main">
                      ${(taxPreview.totalTax || 0).toLocaleString()}
                    </Typography>
                  </Box>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6">Net Proceeds:</Typography>
                    <Typography variant="h6" color="success.main">
                      ${(taxPreview.netValue || 0).toLocaleString()}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip
                    label={taxPreview.isLongTerm ? 'Long-term (>2 years)' : 'Short-term (<2 years)'}
                    color={taxPreview.isLongTerm ? 'success' : 'warning'}
                    size="small"
                  />
                  <Chip
                    label={`Effective Rate: ${(taxPreview.effectiveTaxRate * 100).toFixed(1)}%`}
                    variant="outlined"
                    size="small"
                  />
                </Box>
              </CardContent>
            </Card>
          )}

          <TextField
            fullWidth
            label="Notes (Optional)"
            value={formData.notes}
            onChange={handleInputChange('notes')}
            placeholder="Additional information about this sale..."
            multiline
            rows={3}
          />
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!isFormValid || submitting}
          startIcon={submitting ? <CircularProgress size={20} /> : <MoneyIcon />}
        >
          {submitting ? 'Recording Sale...' : 'Record Sale'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RecordSaleForm;
