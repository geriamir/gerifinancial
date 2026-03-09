import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Divider,
  IconButton,
  Collapse
} from '@mui/material';
import {
  FilterList as FilterListIcon,
  SelectAll as SelectAllIcon,
  TravelExplore as DiscoverIcon
} from '@mui/icons-material';
import { budgetsApi } from '../../services/api/budgets';
import { formatCurrency } from '../../types/foreignCurrency';
import { formatCompactDate } from './ProjectExpensesCompactUtils';

interface DiscoverTransaction {
  _id: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  category?: { _id: string; name: string };
  subCategory?: { _id: string; name: string };
  accountId?: { _id: string; name: string; bankId: string };
  rawData?: {
    originalCurrency?: string;
    originalAmount?: number;
  };
}

interface DiscoverTransactionsDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  onTagged: () => void;
}

const DiscoverTransactionsDialog: React.FC<DiscoverTransactionsDialogProps> = ({
  open,
  onClose,
  projectId,
  projectName,
  onTagged
}) => {
  const [transactions, setTransactions] = useState<DiscoverTransaction[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [tagging, setTagging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagResult, setTagResult] = useState<{ success: number; failed: number } | null>(null);

  // Filters
  const [availableCurrencies, setAvailableCurrencies] = useState<Array<{ code: string; symbol: string; label: string }>>([]);
  const [availableCategories, setAvailableCategories] = useState<Array<{ _id: string; name: string }>>([]);
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [excludeILS, setExcludeILS] = useState(true);
  const [showFilters, setShowFilters] = useState(true);
  const [projectInfo, setProjectInfo] = useState<{ startDate: string; endDate: string; currency: string } | null>(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    setTagResult(null);
    try {
      const result = await budgetsApi.discoverTransactions(projectId, {
        currencies: selectedCurrencies.length > 0 ? selectedCurrencies : undefined,
        categoryIds: selectedCategories.length > 0 ? selectedCategories : undefined,
        excludeILS: selectedCurrencies.length > 0 ? false : excludeILS
      });
      setTransactions(result.data.transactions);
      setAvailableCurrencies(result.data.filters.availableCurrencies);
      setAvailableCategories(result.data.filters.availableCategories);
      setProjectInfo(result.data.project);
      setSelectedIds(new Set(result.data.transactions.map(t => t._id)));
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to discover transactions');
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedCurrencies, selectedCategories, excludeILS]);

  useEffect(() => {
    if (open) {
      fetchTransactions();
    } else {
      // Reset state when closing
      setTransactions([]);
      setSelectedIds(new Set());
      setSelectedCurrencies([]);
      setSelectedCategories([]);
      setExcludeILS(true);
      setTagResult(null);
      setError(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApplyFilters = () => {
    fetchTransactions();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map(t => t._id)));
    }
  };

  const toggleCurrency = (currency: string) => {
    setSelectedCurrencies(prev =>
      prev.includes(currency) ? prev.filter(c => c !== currency) : [...prev, currency]
    );
  };

  const toggleCategory = (catId: string) => {
    setSelectedCategories(prev =>
      prev.includes(catId) ? prev.filter(c => c !== catId) : [...prev, catId]
    );
  };

  const handleTag = async () => {
    if (selectedIds.size === 0) return;
    setTagging(true);
    setError(null);
    try {
      const result = await budgetsApi.bulkTagTransactionsToProject(
        projectId,
        Array.from(selectedIds)
      );
      const successCount = (result as any).data?.successfulTags ?? (result as any).addedCount ?? 0;
      const failedCount = (result as any).data?.errors?.length ?? 0;
      setTagResult({ success: successCount, failed: failedCount });

      // Remove tagged transactions from list
      setTransactions(prev => prev.filter(t => !selectedIds.has(t._id)));
      setSelectedIds(new Set());

      if (successCount > 0) {
        onTagged();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to tag transactions');
    } finally {
      setTagging(false);
    }
  };

  const symbolToISO: Record<string, string> = { '₪': 'ILS', '$': 'USD', '€': 'EUR', '£': 'GBP' };

  const selectedTotal = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const t of transactions) {
      if (selectedIds.has(t._id)) {
        const rawCur = t.rawData?.originalCurrency || t.currency;
        const cur = symbolToISO[rawCur] || rawCur;
        const amt = t.rawData?.originalAmount != null ? Math.abs(t.rawData.originalAmount) : Math.abs(t.amount);
        totals[cur] = (totals[cur] || 0) + amt;
      }
    }
    return totals;
  }, [transactions, selectedIds]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <DiscoverIcon color="primary" />
        Discover Transactions for {projectName}
        {projectInfo && (
          <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
            {formatCompactDate(projectInfo.startDate)} – {formatCompactDate(projectInfo.endDate)}
          </Typography>
        )}
      </DialogTitle>

      <DialogContent dividers>
        {/* Filters */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <IconButton size="small" onClick={() => setShowFilters(!showFilters)}>
              <FilterListIcon />
            </IconButton>
            <Typography variant="subtitle2">Filters</Typography>
            {!showFilters && (
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {excludeILS && selectedCurrencies.length === 0 && (
                  <Chip label="Excluding ILS" size="small" />
                )}
                {selectedCurrencies.map(code => {
                  const cur = availableCurrencies.find(c => c.code === code);
                  return <Chip key={code} label={cur?.label || code} size="small" color="primary" variant="outlined" />;
                })}
                {selectedCategories.length > 0 && (
                  <Chip label={`${selectedCategories.length} categories`} size="small" color="secondary" variant="outlined" />
                )}
              </Box>
            )}
          </Box>

          <Collapse in={showFilters}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              {/* Currency filters */}
              <Typography variant="body2" fontWeight="bold" gutterBottom>Currencies</Typography>
              <FormGroup row sx={{ mb: 1 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={excludeILS && selectedCurrencies.length === 0}
                      onChange={(e) => {
                        setExcludeILS(e.target.checked);
                        if (e.target.checked) setSelectedCurrencies([]);
                      }}
                    />
                  }
                  label="Foreign currencies only (exclude ILS)"
                />
              </FormGroup>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
                {availableCurrencies.map(cur => (
                  <Chip
                    key={cur.code}
                    label={cur.label}
                    size="small"
                    color={selectedCurrencies.includes(cur.code) ? 'primary' : 'default'}
                    variant={selectedCurrencies.includes(cur.code) ? 'filled' : 'outlined'}
                    onClick={() => {
                      toggleCurrency(cur.code);
                      setExcludeILS(false);
                    }}
                  />
                ))}
              </Box>

              {/* Category filters */}
              <Typography variant="body2" fontWeight="bold" gutterBottom>Categories (optional)</Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                {availableCategories.map(cat => (
                  <Chip
                    key={cat._id}
                    label={cat.name}
                    size="small"
                    color={selectedCategories.includes(cat._id) ? 'secondary' : 'default'}
                    variant={selectedCategories.includes(cat._id) ? 'filled' : 'outlined'}
                    onClick={() => toggleCategory(cat._id)}
                  />
                ))}
              </Box>

              <Button
                variant="contained"
                size="small"
                onClick={handleApplyFilters}
                disabled={loading}
                sx={{ mt: 1 }}
              >
                Apply Filters
              </Button>
            </Paper>
          </Collapse>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Results */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        ) : transactions.length === 0 ? (
          <Alert severity="info">No matching transactions found in the project date range.</Alert>
        ) : (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} found
                {selectedIds.size > 0 && ` · ${selectedIds.size} selected`}
              </Typography>
              <Button
                size="small"
                startIcon={<SelectAllIcon />}
                onClick={toggleSelectAll}
              >
                {selectedIds.size === transactions.length ? 'Deselect All' : 'Select All'}
              </Button>
            </Box>

            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={selectedIds.size > 0 && selectedIds.size < transactions.length}
                        checked={selectedIds.size === transactions.length}
                        onChange={toggleSelectAll}
                      />
                    </TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.map(tx => (
                    <TableRow
                      key={tx._id}
                      hover
                      onClick={() => toggleSelect(tx._id)}
                      selected={selectedIds.has(tx._id)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox checked={selectedIds.has(tx._id)} />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {formatCompactDate(tx.date)}
                      </TableCell>
                      <TableCell>{tx.description}</TableCell>
                      <TableCell>
                        {tx.category ? (
                          <Typography variant="body2" color="text.secondary">
                            {tx.category.name}
                            {tx.subCategory && ` → ${tx.subCategory.name}`}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.disabled" fontStyle="italic">
                            Uncategorized
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        {tx.rawData?.originalCurrency && tx.rawData?.originalAmount ? (
                          <Box>
                            <Typography variant="body2">
                              {tx.rawData.originalCurrency}{Math.abs(tx.rawData.originalAmount).toFixed(2)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatCurrency(Math.abs(tx.amount), tx.currency)}
                            </Typography>
                          </Box>
                        ) : (
                          formatCurrency(Math.abs(tx.amount), tx.currency)
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {/* Tag result */}
        {tagResult && (
          <Alert severity={tagResult.failed > 0 ? 'warning' : 'success'} sx={{ mt: 2 }}>
            Tagged {tagResult.success} transaction{tagResult.success !== 1 ? 's' : ''} to project.
            {tagResult.failed > 0 && ` ${tagResult.failed} failed.`}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Box>
          {selectedIds.size > 0 && Object.entries(selectedTotal).map(([currency, total]) => (
            <Chip
              key={currency}
              label={`${formatCurrency(total, currency)}`}
              size="small"
              sx={{ mr: 0.5 }}
            />
          ))}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose}>Close</Button>
          <Button
            variant="contained"
            onClick={handleTag}
            disabled={selectedIds.size === 0 || tagging}
            startIcon={tagging ? <CircularProgress size={16} /> : undefined}
          >
            Tag {selectedIds.size} Transaction{selectedIds.size !== 1 ? 's' : ''}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default DiscoverTransactionsDialog;
