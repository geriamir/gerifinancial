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
  Tabs,
  Tab,
  Paper,
  Alert,
  CircularProgress,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Grid,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
  Calculate as CalculateIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { budgetsApi } from '../../services/api/budgets';
import { formatCurrencyDisplay } from '../../utils/formatters';
import { MONTH_NAMES } from '../../constants/dateConstants';

interface BudgetEditorProps {
  open: boolean;
  onClose: () => void;
  categoryId: string;
  subCategoryId?: string;
  categoryName: string;
  subcategoryName?: string;
  onBudgetUpdated?: () => void;
}

interface BudgetData {
  _id: string | null;
  budgetType: 'fixed' | 'variable';
  fixedAmount: number;
  monthlyAmounts: Array<{ month: number; amount: number }>;
  isManuallyEdited: boolean;
  isUniformAcrossMonths: boolean;
  allMonthsData: Array<{ month: number; amount: number }>;
}

const BudgetEditor: React.FC<BudgetEditorProps> = ({
  open,
  onClose,
  categoryId,
  subCategoryId,
  categoryName,
  subcategoryName,
  onBudgetUpdated,
}) => {
  const [budgetData, setBudgetData] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [reason, setReason] = useState('');
  const [recalculateLoading, setRecalculateLoading] = useState(false);

  // Local state for editing
  const [editedBudgetType, setEditedBudgetType] = useState<'fixed' | 'variable'>('fixed');
  const [editedFixedAmount, setEditedFixedAmount] = useState<string>('0');
  const [editedMonthlyAmounts, setEditedMonthlyAmounts] = useState<{ [month: number]: string }>({});

  // Load budget data when dialog opens
  useEffect(() => {
    if (!open || !categoryId) return;

    const loadBudgetData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const data = await budgetsApi.getBudgetForEditing(categoryId, subCategoryId);
        console.log('Budget data received:', data); // Debug log
        setBudgetData(data);
        
        // Initialize local editing state
        setEditedBudgetType(data.budgetType || 'fixed');
        
        // Initialize monthly amounts - handle both new and existing budgets
        const monthlyAmountsMap: { [month: number]: string } = {};
        
        if (data.allMonthsData && Array.isArray(data.allMonthsData)) {
          // Use the allMonthsData array from backend
          data.allMonthsData.forEach(({ month, amount }) => {
            monthlyAmountsMap[month] = (amount || 0).toString();
          });
        } else {
          // Fallback: Initialize with zeros for all months if no data
          for (let month = 1; month <= 12; month++) {
            monthlyAmountsMap[month] = '0';
          }
        }
        
        setEditedMonthlyAmounts(monthlyAmountsMap);
        
        // For fixed budgets, determine the fixed amount from the data
        let fixedAmount = data.fixedAmount || 0;
        console.log('Initial fixedAmount from data:', data.fixedAmount);
        console.log('Budget type:', data.budgetType);
        console.log('AllMonthsData:', data.allMonthsData);
        
        // If budget type is fixed but fixedAmount is 0, try to get it from monthly data
        if ((data.budgetType === 'fixed' || !data.budgetType) && fixedAmount === 0 && data.allMonthsData?.length > 0) {
          // Check if all months have the same amount (indicating a fixed budget)
          const amounts = data.allMonthsData.map(({ amount }) => amount || 0);
          const firstAmount = amounts[0];
          const allSame = amounts.every(amount => amount === firstAmount);
          
          console.log('Monthly amounts:', amounts);
          console.log('First amount:', firstAmount);
          console.log('All same?', allSame);
          
          if (allSame && firstAmount > 0) {
            fixedAmount = firstAmount;
            console.log('Setting fixed amount from monthly data:', fixedAmount);
          }
        }
        
        console.log('Final fixed amount to be set:', fixedAmount);
        setEditedFixedAmount(fixedAmount.toString());
        
      } catch (err) {
        console.error('Failed to load budget data:', err);
        console.error('Error details:', err);
        setError(`Failed to load budget data: ${(err as Error).message || 'Please try again.'}`);
      } finally {
        setLoading(false);
      }
    };

    loadBudgetData();
  }, [open, categoryId, subCategoryId]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setBudgetData(null);
      setError(null);
      setReason('');
      setActiveTab(0);
    }
  }, [open]);

  const handleBudgetTypeChange = (newType: 'fixed' | 'variable') => {
    setEditedBudgetType(newType);
  };

  const handleFixedAmountChange = (value: string) => {
    setEditedFixedAmount(value);
  };

  const handleMonthlyAmountChange = (month: number, value: string) => {
    setEditedMonthlyAmounts(prev => ({
      ...prev,
      [month]: value
    }));
  };

  const handleRecalculate = async () => {
    try {
      setRecalculateLoading(true);
      setError(null);
      
      const result = await budgetsApi.recalculateBudgetWithExclusions(
        categoryId, 
        subCategoryId, 
        6 // 6 months analysis
      );
      
      // Update the budget with recalculated amount
      if (editedBudgetType === 'fixed') {
        setEditedFixedAmount(result.recalculatedAmount.toString());
      } else {
        // For variable budgets, set all months to the recalculated amount
        const newMonthlyAmounts: { [month: number]: string } = {};
        for (let month = 1; month <= 12; month++) {
          newMonthlyAmounts[month] = result.recalculatedAmount.toString();
        }
        setEditedMonthlyAmounts(newMonthlyAmounts);
      }
      
      alert(`Budget recalculated based on ${result.transactionCount} transactions over ${result.averagingPeriod} months (${result.excludedTransactions} excluded).`);
      
    } catch (err) {
      console.error('Failed to recalculate budget:', err);
      setError('Failed to recalculate budget. Please try again.');
    } finally {
      setRecalculateLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      
      const budgetUpdateData: any = {
        budgetType: editedBudgetType,
        reason: reason.trim() || 'Manual budget edit'
      };
      
      if (editedBudgetType === 'fixed') {
        budgetUpdateData.fixedAmount = parseFloat(editedFixedAmount) || 0;
      } else {
        budgetUpdateData.monthlyAmounts = Object.entries(editedMonthlyAmounts).map(([month, amount]) => ({
          month: parseInt(month),
          amount: parseFloat(amount) || 0
        }));
      }
      
      await budgetsApi.updateCategoryBudget(categoryId, subCategoryId || null, budgetUpdateData);
      
      onBudgetUpdated?.();
      onClose();
      
    } catch (err) {
      console.error('Failed to save budget:', err);
      setError('Failed to save budget. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderFixedBudgetTab = () => (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Fixed Monthly Budget
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Set the same budget amount for every month of the year.
      </Typography>
      
      <TextField
        label="Monthly Budget Amount"
        type="number"
        value={editedFixedAmount}
        onChange={(e) => handleFixedAmountChange(e.target.value)}
        fullWidth
        inputProps={{ min: 0, step: 0.01 }}
        sx={{ mb: 2 }}
        helperText={`This amount will be used for all 12 months`}
      />
      
      {parseFloat(editedFixedAmount) > 0 && (
        <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
          <Typography variant="subtitle2" gutterBottom>
            Preview: Annual Total
          </Typography>
          <Typography variant="h6" color="primary">
            {formatCurrencyDisplay(parseFloat(editedFixedAmount) * 12)}
          </Typography>
        </Paper>
      )}
    </Box>
  );

  const renderVariableBudgetTab = () => (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Variable Monthly Budget
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Set different budget amounts for each month of the year.
      </Typography>
      
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
          <TextField
            key={month}
            label={MONTH_NAMES[month - 1]}
            type="number"
            value={editedMonthlyAmounts[month] || '0'}
            onChange={(e) => handleMonthlyAmountChange(month, e.target.value)}
            fullWidth
            size="small"
            inputProps={{ min: 0, step: 0.01 }}
          />
        ))}
      </Box>
      
      <Divider sx={{ my: 3 }} />
      
      <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
        <Typography variant="subtitle2" gutterBottom>
          Annual Total
        </Typography>
        <Typography variant="h6" color="primary">
          {formatCurrencyDisplay(
            Object.values(editedMonthlyAmounts).reduce((sum, amount) => sum + (parseFloat(amount) || 0), 0)
          )}
        </Typography>
      </Paper>
    </Box>
  );

  if (!budgetData && loading) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box>
          <Typography variant="h6" component="div">
            Edit Budget
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {categoryName} {subcategoryName && `• ${subcategoryName}`}
          </Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'grey.500' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {error && (
          <Alert severity="error" sx={{ m: 3, mb: 0 }}>
            {error}
          </Alert>
        )}

        {budgetData && (
          <>
            {/* Budget Type Selection */}
            <Box sx={{ p: 3, pb: 0 }}>
              <FormControl component="fieldset">
                <FormLabel component="legend">Budget Type</FormLabel>
                <RadioGroup
                  row
                  value={editedBudgetType}
                  onChange={(e) => handleBudgetTypeChange(e.target.value as 'fixed' | 'variable')}
                >
                  <FormControlLabel
                    value="fixed"
                    control={<Radio />}
                    label="Fixed (same amount every month)"
                  />
                  <FormControlLabel
                    value="variable"
                    control={<Radio />}
                    label="Variable (different amounts per month)"
                  />
                </RadioGroup>
              </FormControl>
            </Box>

            {/* Budget Input Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs
                value={editedBudgetType === 'fixed' ? 0 : 1}
                onChange={(_, newValue) => setActiveTab(newValue)}
              >
                <Tab
                  label="Fixed Budget"
                  disabled={editedBudgetType !== 'fixed'}
                />
                <Tab
                  label="Variable Budget"
                  disabled={editedBudgetType !== 'variable'}
                />
              </Tabs>
            </Box>

            {/* Tab Content */}
            {editedBudgetType === 'fixed' ? renderFixedBudgetTab() : renderVariableBudgetTab()}

            {/* Reason Field */}
            <Box sx={{ p: 3, pt: 0 }}>
              <TextField
                label="Reason for Change (Optional)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                fullWidth
                multiline
                rows={2}
                placeholder="e.g., Adjusted for seasonal expenses, updated based on new information..."
                helperText="Provide a brief explanation for this budget change"
              />
            </Box>

            {/* Budget Info */}
            {budgetData.isManuallyEdited && (
              <Box sx={{ p: 3, pt: 0 }}>
                <Alert severity="info" icon={<InfoIcon />}>
                  This budget has been manually edited before. Your changes will override any previous edits.
                </Alert>
              </Box>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'space-between' }}>
        <Box>
          <Tooltip title="Recalculate budget based on historical transactions (excluding marked transactions)">
            <Button
              startIcon={recalculateLoading ? <CircularProgress size={16} /> : <CalculateIcon />}
              onClick={handleRecalculate}
              disabled={recalculateLoading || saving}
              variant="outlined"
              color="secondary"
            >
              {recalculateLoading ? 'Recalculating...' : 'Auto-Recalculate'}
            </Button>
          </Tooltip>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={saving || loading}
            startIcon={saving ? <CircularProgress size={16} /> : undefined}
          >
            {saving ? 'Saving...' : 'Save Budget'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default BudgetEditor;
