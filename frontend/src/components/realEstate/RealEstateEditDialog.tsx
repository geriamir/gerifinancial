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
  Divider,
  Chip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  Add as AddIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { RealEstateInvestment, FundingSource, realEstateApi } from '../../services/api/realEstate';
import { SUPPORTED_CURRENCIES, formatCurrency } from '../../types/foreignCurrency';

interface RealEstateEditDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (investment: RealEstateInvestment) => void;
  investment: RealEstateInvestment;
}

interface FundingSourceForm {
  type: FundingSource['type'];
  description: string;
  expectedAmount: number;
  availableAmount: number;
  currency: string;
}

const FUNDING_TYPES: { value: FundingSource['type']; label: string }[] = [
  { value: 'loan', label: 'Loan' },
  { value: 'savings', label: 'Savings' },
  { value: 'partner', label: 'Partner' },
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'other', label: 'Other' }
];

const RealEstateEditDialog: React.FC<RealEstateEditDialogProps> = ({
  open,
  onClose,
  onSuccess,
  investment
}) => {
  const [formData, setFormData] = useState({
    name: '',
    type: 'flip' as 'flip' | 'rental',
    status: 'active' as RealEstateInvestment['status'],
    address: '',
    description: '',
    currency: 'USD',
    totalInvestment: 0,
    estimatedCurrentValue: 0,
    notes: '',
    // Flip-specific
    salePrice: 0,
    saleDate: null as Date | null,
    saleExpenses: 0,
    // Rental-specific
    monthlyRent: 0,
    tenantName: '',
    leaseStart: null as Date | null,
    leaseEnd: null as Date | null
  });
  const [fundingSources, setFundingSources] = useState<FundingSourceForm[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (open && investment) {
      setFormData({
        name: investment.name || '',
        type: investment.type || 'flip',
        status: investment.status || 'active',
        address: investment.address || '',
        description: investment.description || '',
        currency: investment.currency || 'USD',
        totalInvestment: investment.totalInvestment || 0,
        estimatedCurrentValue: investment.estimatedCurrentValue || 0,
        notes: investment.notes || '',
        salePrice: investment.salePrice || 0,
        saleDate: investment.saleDate ? new Date(investment.saleDate) : null,
        saleExpenses: investment.saleExpenses || 0,
        monthlyRent: investment.monthlyRent || 0,
        tenantName: investment.tenantName || '',
        leaseStart: investment.leaseStart ? new Date(investment.leaseStart) : null,
        leaseEnd: investment.leaseEnd ? new Date(investment.leaseEnd) : null
      });
      setFundingSources(
        (investment.fundingSources || []).map(fs => ({
          type: fs.type,
          description: fs.description,
          expectedAmount: fs.expectedAmount,
          availableAmount: fs.availableAmount,
          currency: fs.currency
        }))
      );
      setErrors({});
      setSubmitError(null);
    }
  }, [open, investment]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddFundingSource = () => {
    setFundingSources(prev => [
      ...prev,
      { type: 'savings', description: '', expectedAmount: 0, availableAmount: 0, currency: formData.currency }
    ]);
  };

  const handleRemoveFundingSource = (index: number) => {
    setFundingSources(prev => prev.filter((_, i) => i !== index));
  };

  const handleFundingSourceChange = (index: number, field: keyof FundingSourceForm, value: any) => {
    setFundingSources(prev => prev.map((fs, i) => i === index ? { ...fs, [field]: value } : fs));
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    try {
      setIsSubmitting(true);
      setSubmitError(null);
      const updateData: Partial<RealEstateInvestment> = {
        name: formData.name,
        type: formData.type,
        status: formData.status,
        address: formData.address || undefined,
        description: formData.description || undefined,
        currency: formData.currency,
        totalInvestment: formData.totalInvestment,
        estimatedCurrentValue: formData.estimatedCurrentValue,
        notes: formData.notes || undefined,
        fundingSources: fundingSources.map(fs => ({
          type: fs.type,
          description: fs.description,
          expectedAmount: fs.expectedAmount,
          availableAmount: fs.availableAmount,
          currency: fs.currency
        }))
      };

      if (formData.type === 'flip') {
        updateData.salePrice = formData.salePrice || undefined;
        updateData.saleDate = formData.saleDate?.toISOString() || undefined;
        updateData.saleExpenses = formData.saleExpenses || undefined;
      }
      if (formData.type === 'rental') {
        updateData.monthlyRent = formData.monthlyRent || undefined;
        updateData.tenantName = formData.tenantName || undefined;
        updateData.leaseStart = formData.leaseStart?.toISOString() || undefined;
        updateData.leaseEnd = formData.leaseEnd?.toISOString() || undefined;
      }

      const updated = await realEstateApi.update(investment._id, updateData);
      onSuccess(updated);
      onClose();
    } catch (error: any) {
      setSubmitError(error?.response?.data?.message || 'Failed to update investment');
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
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Edit Investment</Typography>
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
            helperText={errors.name}
            disabled={isSubmitting}
            required
          />

          <Box display="flex" gap={2}>
            <FormControl fullWidth disabled={isSubmitting}>
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
              <InputLabel>Status</InputLabel>
              <Select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as RealEstateInvestment['status'] }))}
                label="Status"
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="sold">Sold</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
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
              disabled={isSubmitting}
              inputProps={{ min: 0, step: 0.01 }}
            />
            <TextField
              fullWidth
              label="Estimated Current Value"
              type="number"
              value={formData.estimatedCurrentValue || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, estimatedCurrentValue: parseFloat(e.target.value) || 0 }))}
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
            rows={2}
          />

          {/* Funding Sources */}
          <Divider sx={{ my: 1 }} />
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle1" fontWeight="bold">Funding Sources</Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={handleAddFundingSource} disabled={isSubmitting}>
              Add Source
            </Button>
          </Box>

          {fundingSources.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No funding sources added yet.</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Type</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Expected</TableCell>
                  <TableCell>Available</TableCell>
                  <TableCell width={50} />
                </TableRow>
              </TableHead>
              <TableBody>
                {fundingSources.map((fs, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Select
                        size="small"
                        value={fs.type}
                        onChange={(e) => handleFundingSourceChange(index, 'type', e.target.value)}
                        disabled={isSubmitting}
                        variant="standard"
                      >
                        {FUNDING_TYPES.map(ft => (
                          <MenuItem key={ft.value} value={ft.value}>{ft.label}</MenuItem>
                        ))}
                      </Select>
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={fs.description}
                        onChange={(e) => handleFundingSourceChange(index, 'description', e.target.value)}
                        disabled={isSubmitting}
                        variant="standard"
                        placeholder="Description"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        type="number"
                        value={fs.expectedAmount || ''}
                        onChange={(e) => handleFundingSourceChange(index, 'expectedAmount', parseFloat(e.target.value) || 0)}
                        disabled={isSubmitting}
                        variant="standard"
                        inputProps={{ min: 0, step: 0.01 }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        type="number"
                        value={fs.availableAmount || ''}
                        onChange={(e) => handleFundingSourceChange(index, 'availableAmount', parseFloat(e.target.value) || 0)}
                        disabled={isSubmitting}
                        variant="standard"
                        inputProps={{ min: 0, step: 0.01 }}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => handleRemoveFundingSource(index)} disabled={isSubmitting}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {fundingSources.length > 0 && (
            <Typography variant="body2" color="text.secondary">
              Total Expected: {formatCurrency(fundingSources.reduce((sum, fs) => sum + fs.expectedAmount, 0), formData.currency)} |
              Total Available: {formatCurrency(fundingSources.reduce((sum, fs) => sum + fs.availableAmount, 0), formData.currency)}
            </Typography>
          )}

          {/* Type-specific fields */}
          {formData.type === 'flip' && (
            <>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle1" fontWeight="bold">
                Sale Information <Chip label="Flip" size="small" color="primary" sx={{ ml: 1 }} />
              </Typography>
              <Box display="flex" gap={2}>
                <TextField
                  fullWidth
                  label="Sale Price"
                  type="number"
                  value={formData.salePrice || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, salePrice: parseFloat(e.target.value) || 0 }))}
                  disabled={isSubmitting}
                  inputProps={{ min: 0, step: 0.01 }}
                />
                <TextField
                  fullWidth
                  label="Sale Expenses"
                  type="number"
                  value={formData.saleExpenses || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, saleExpenses: parseFloat(e.target.value) || 0 }))}
                  disabled={isSubmitting}
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Box>
              <DatePicker
                label="Sale Date"
                value={formData.saleDate}
                onChange={(date) => setFormData(prev => ({ ...prev, saleDate: date }))}
                disabled={isSubmitting}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </>
          )}

          {formData.type === 'rental' && (
            <>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle1" fontWeight="bold">
                Rental Details <Chip label="Rental" size="small" color="secondary" sx={{ ml: 1 }} />
              </Typography>
              <Box display="flex" gap={2}>
                <TextField
                  fullWidth
                  label="Monthly Rent"
                  type="number"
                  value={formData.monthlyRent || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, monthlyRent: parseFloat(e.target.value) || 0 }))}
                  disabled={isSubmitting}
                  inputProps={{ min: 0, step: 0.01 }}
                />
                <TextField
                  fullWidth
                  label="Tenant Name"
                  value={formData.tenantName}
                  onChange={(e) => setFormData(prev => ({ ...prev, tenantName: e.target.value }))}
                  disabled={isSubmitting}
                />
              </Box>
              <Box display="flex" gap={2}>
                <DatePicker
                  label="Lease Start"
                  value={formData.leaseStart}
                  onChange={(date) => setFormData(prev => ({ ...prev, leaseStart: date }))}
                  disabled={isSubmitting}
                  slotProps={{ textField: { fullWidth: true } }}
                />
                <DatePicker
                  label="Lease End"
                  value={formData.leaseEnd}
                  onChange={(date) => setFormData(prev => ({ ...prev, leaseEnd: date }))}
                  disabled={isSubmitting}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Box>
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
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RealEstateEditDialog;
