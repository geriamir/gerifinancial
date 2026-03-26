import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Button,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Paper,
  SelectChangeEvent
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  AccountBalance as LinkBankIcon,
  LinkOff as UnlinkIcon,
  CheckCircle as PaidIcon,
  Schedule as PendingIcon,
  Warning as OverdueIcon,
  Home as HomeIcon,
  LocationOn as LocationIcon
} from '@mui/icons-material';
import {
  realEstateApi,
  RealEstateInvestment,
  RealEstateSummary,
  Commitment
} from '../services/api/realEstate';
import { formatCurrency } from '../types/foreignCurrency';
import { foreignCurrencyApi } from '../services/api/foreignCurrency';
import RealEstateCreateDialog from '../components/realEstate/RealEstateCreateDialog';
import RealEstateEditDialog from '../components/realEstate/RealEstateEditDialog';
import CommitmentDialog from '../components/realEstate/CommitmentDialog';

const getStatusColor = (status: string): 'success' | 'info' | 'default' | 'error' | 'warning' => {
  switch (status) {
    case 'active': return 'success';
    case 'sold': return 'info';
    case 'completed': return 'default';
    case 'cancelled': return 'error';
    default: return 'default';
  }
};

const getCommitmentStatusIcon = (status: string) => {
  switch (status) {
    case 'paid': return <PaidIcon fontSize="small" color="success" />;
    case 'overdue': return <OverdueIcon fontSize="small" color="error" />;
    default: return <PendingIcon fontSize="small" color="warning" />;
  }
};

// ==================== LIST VIEW ====================

interface RealEstateListProps {
  onNavigateToDetail: (id: string) => void;
}

const RealEstateList: React.FC<RealEstateListProps> = ({ onNavigateToDetail }) => {
  const [investments, setInvestments] = useState<RealEstateInvestment[]>([]);
  const [summary, setSummary] = useState<RealEstateSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const filters: { type?: string; status?: string } = {};
      if (typeFilter) filters.type = typeFilter;
      if (statusFilter) filters.status = statusFilter;
      const [investmentsData, summaryData] = await Promise.all([
        realEstateApi.getAll(filters),
        realEstateApi.getSummary()
      ]);
      setInvestments(investmentsData);
      setSummary(summaryData);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load investments');
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateSuccess = () => {
    fetchData();
  };

  const summaryCards = summary ? [
    { label: 'Total Invested', value: formatCurrency(summary.totalInvested, summary.currency || 'USD') },
    { label: 'Estimated Value', value: formatCurrency(summary.totalEstimatedValue, summary.currency || 'USD') },
    { label: 'Active Flips', value: summary.activeFlips.toString() },
    { label: 'Active Rentals', value: summary.activeRentals.toString() },
    { label: 'Total Commitments', value: formatCurrency(summary.totalCommitments, summary.currency || 'USD') },
    { label: 'Rental Income', value: formatCurrency(summary.totalRentalIncome, summary.currency || 'USD') }
  ] : [];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Real Estate Investments</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Add Investment
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Summary Cards */}
          {summary && (
            <Grid container spacing={2} sx={{ mb: 3 }}>
              {summaryCards.map((card) => (
                <Grid size={{ xs: 6, sm: 4, md: 2 }} key={card.label}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center', py: 2 }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {card.label}
                      </Typography>
                      <Typography variant="h6" fontWeight="bold">
                        {card.value}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}

          {/* Filters */}
          <Box display="flex" gap={2} mb={3}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Type</InputLabel>
              <Select
                value={typeFilter}
                onChange={(e: SelectChangeEvent) => setTypeFilter(e.target.value)}
                label="Type"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="flip">Flip</MenuItem>
                <MenuItem value="rental">Rental</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e: SelectChangeEvent) => setStatusFilter(e.target.value)}
                label="Status"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="sold">Sold</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Investment Cards Grid */}
          {investments.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <HomeIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No investments found
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Start by adding your first real estate investment.
              </Typography>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setCreateDialogOpen(true)}>
                Add Investment
              </Button>
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {investments.map((inv) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={inv._id}>
                  <Card sx={{ height: '100%' }}>
                    <CardActionArea onClick={() => onNavigateToDetail(inv._id)} sx={{ height: '100%' }}>
                      <CardContent>
                        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                          <Typography variant="h6" noWrap sx={{ flex: 1, mr: 1 }}>
                            {inv.name}
                          </Typography>
                          <Chip
                            label={inv.type}
                            size="small"
                            color={inv.type === 'flip' ? 'primary' : 'secondary'}
                            variant="outlined"
                          />
                        </Box>
                        {inv.address && (
                          <Box display="flex" alignItems="center" gap={0.5} mb={1}>
                            <LocationIcon fontSize="small" color="action" />
                            <Typography variant="body2" color="text.secondary" noWrap>
                              {inv.address}
                            </Typography>
                          </Box>
                        )}
                        <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
                          <Typography variant="body2" color="text.secondary">
                            Invested: {formatCurrency(inv.totalInvestment, inv.currency)}
                          </Typography>
                          <Chip
                            label={inv.status}
                            size="small"
                            color={getStatusColor(inv.status)}
                          />
                        </Box>
                        <Typography variant="body2" color="text.secondary" mt={0.5}>
                          Value: {formatCurrency(inv.estimatedCurrentValue, inv.currency)}
                        </Typography>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}

      <RealEstateCreateDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </Box>
  );
};

// ==================== DETAIL VIEW ====================

interface RealEstateDetailProps {
  investmentId: string;
}

const RealEstateDetail: React.FC<RealEstateDetailProps> = ({ investmentId }) => {
  const navigate = useNavigate();
  const [investment, setInvestment] = useState<RealEstateInvestment | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [totalInvestmentConverted, setTotalInvestmentConverted] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [commitmentDialogOpen, setCommitmentDialogOpen] = useState(false);
  const [editingCommitment, setEditingCommitment] = useState<Commitment | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [inv, txns] = await Promise.all([
        realEstateApi.getById(investmentId),
        realEstateApi.getTransactions(investmentId).catch(() => [])
      ]);
      setInvestment(inv);
      setTransactions(txns);

      // Compute total investment converted to the investment's currency
      const invCurrency = inv.currency || 'USD';
      const totalsByCurrency: Record<string, number> = {};
      for (const txn of txns) {
        const txnCur = txn.currency || invCurrency;
        totalsByCurrency[txnCur] = (totalsByCurrency[txnCur] || 0) + (txn.amount || 0);
      }
      let convertedTotal = 0;
      for (const [cur, sum] of Object.entries(totalsByCurrency)) {
        const negatedSum = sum * -1;
        if (cur === invCurrency) {
          convertedTotal += negatedSum;
        } else {
          try {
            const result = await foreignCurrencyApi.convertCurrency({
              amount: Math.abs(negatedSum),
              fromCurrency: cur,
              toCurrency: invCurrency
            });
            convertedTotal += negatedSum < 0 ? -result.convertedAmount : result.convertedAmount;
          } catch {
            convertedTotal += negatedSum;
          }
        }
      }
      setTotalInvestmentConverted(convertedTotal);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load investment');
    } finally {
      setLoading(false);
    }
  }, [investmentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await realEstateApi.delete(investmentId);
      navigate('/real-estate');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to delete investment');
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleEditSuccess = (updated: RealEstateInvestment) => {
    setInvestment(updated);
  };

  const handleSaveCommitment = async (data: Partial<Commitment>) => {
    if (editingCommitment) {
      const updated = await realEstateApi.updateCommitment(investmentId, editingCommitment._id, data);
      setInvestment(updated);
    } else {
      const updated = await realEstateApi.addCommitment(investmentId, data);
      setInvestment(updated);
    }
    setEditingCommitment(null);
  };

  const handleDeleteCommitment = async (commitmentId: string) => {
    try {
      const updated = await realEstateApi.deleteCommitment(investmentId, commitmentId);
      setInvestment(updated);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to delete commitment');
    }
  };

  const handleLinkBank = async () => {
    // Placeholder - in a full implementation you'd open a bank account picker dialog
    setError('Bank account linking dialog not yet implemented. Use the API directly.');
  };

  const handleUnlinkBank = async () => {
    try {
      const updated = await realEstateApi.unlinkBankAccount(investmentId);
      setInvestment(updated);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to unlink bank account');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !investment) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!investment) {
    return <Alert severity="warning">Investment not found.</Alert>;
  }

  const currency = investment.currency || 'USD';
  const gainLoss = investment.type === 'flip' && investment.flipGain != null
    ? investment.flipGain
    : investment.estimatedCurrentValue - totalInvestmentConverted;

  return (
    <Box>
      {/* Back button & actions */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/real-estate')}>
          Back to Investments
        </Button>
        <Box display="flex" gap={1}>
          {investment.linkedBankAccountId ? (
            <Tooltip title="Unlink Bank Account">
              <Button size="small" startIcon={<UnlinkIcon />} onClick={handleUnlinkBank} color="warning">
                Unlink Account
              </Button>
            </Tooltip>
          ) : (
            <Button size="small" startIcon={<LinkBankIcon />} onClick={handleLinkBank} variant="outlined">
              Link Bank Account
            </Button>
          )}
          <Button startIcon={<EditIcon />} onClick={() => setEditDialogOpen(true)} variant="outlined">
            Edit
          </Button>
          <Button startIcon={<DeleteIcon />} onClick={() => setDeleteDialogOpen(true)} color="error" variant="outlined">
            Delete
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <Typography variant="h4">{investment.name}</Typography>
              <Chip label={investment.type} color={investment.type === 'flip' ? 'primary' : 'secondary'} size="small" />
              <Chip label={investment.status} color={getStatusColor(investment.status)} size="small" />
            </Box>
            {investment.address && (
              <Box display="flex" alignItems="center" gap={0.5}>
                <LocationIcon fontSize="small" color="action" />
                <Typography variant="body1" color="text.secondary">{investment.address}</Typography>
              </Box>
            )}
            {investment.description && (
              <Typography variant="body2" color="text.secondary" mt={1}>
                {investment.description}
              </Typography>
            )}
          </Box>
        </Box>
      </Paper>

      {/* Financial Overview */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Total Investment</Typography>
              <Typography variant="h5" fontWeight="bold">
                {formatCurrency(totalInvestmentConverted, currency)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Estimated Current Value</Typography>
              <Typography variant="h5" fontWeight="bold">
                {formatCurrency(investment.estimatedCurrentValue, currency)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                {investment.type === 'flip' ? 'Gain/Loss' : 'Unrealized Gain/Loss'}
              </Typography>
              <Typography
                variant="h5"
                fontWeight="bold"
                color={gainLoss >= 0 ? 'success.main' : 'error.main'}
              >
                {gainLoss >= 0 ? '+' : ''}{formatCurrency(gainLoss, currency)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Commitments Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Commitments</Typography>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditingCommitment(null);
              setCommitmentDialogOpen(true);
            }}
          >
            Add Commitment
          </Button>
        </Box>
        {investment.commitments && investment.commitments.length > 0 ? (
          <>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {investment.commitments.map((c) => (
                  <TableRow key={c._id}>
                    <TableCell>{c.description}</TableCell>
                    <TableCell align="right">{formatCurrency(c.amount, c.currency || currency)}</TableCell>
                    <TableCell>{new Date(c.dueDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={0.5}>
                        {getCommitmentStatusIcon(c.status)}
                        <Chip label={c.status} size="small" color={
                          c.status === 'paid' ? 'success' : c.status === 'overdue' ? 'error' : 'warning'
                        } variant="outlined" />
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setEditingCommitment(c);
                          setCommitmentDialogOpen(true);
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteCommitment(c._id)} color="error">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {investment.totalCommitted != null && (
              <Box display="flex" justifyContent="flex-end" mt={1}>
                <Typography variant="body2" color="text.secondary">
                  Total Committed: {formatCurrency(investment.totalCommitted, currency)}
                  {investment.totalPaidCommitments != null && ` | Paid: ${formatCurrency(investment.totalPaidCommitments, currency)}`}
                </Typography>
              </Box>
            )}
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">No commitments yet.</Typography>
        )}
      </Paper>

      {/* Rental Income Section (rentals only) */}
      {investment.type === 'rental' && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" mb={2}>Rental Income</Typography>
          {investment.monthlyRent != null && investment.monthlyRent > 0 && (
            <Box mb={2}>
              <Typography variant="body2" color="text.secondary">
                Monthly Rent: {formatCurrency(investment.monthlyRent, currency)}
                {investment.tenantName && ` | Tenant: ${investment.tenantName}`}
              </Typography>
              {investment.leaseStart && (
                <Typography variant="body2" color="text.secondary">
                  Lease: {new Date(investment.leaseStart).toLocaleDateString()}
                  {investment.leaseEnd && ` — ${new Date(investment.leaseEnd).toLocaleDateString()}`}
                </Typography>
              )}
            </Box>
          )}
          {((investment.estimatedMonthlyRental != null && investment.estimatedMonthlyRental > 0) ||
            (investment.mortgagePercentage != null && investment.mortgagePercentage > 0)) && (
            <Box sx={{ p: 2, mb: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="subtitle2" fontWeight="bold" mb={1}>Financing Estimates</Typography>
              {investment.estimatedMonthlyRental != null && investment.estimatedMonthlyRental > 0 && (
                <Typography variant="body2" color="text.secondary">
                  Estimated Monthly Rental: {formatCurrency(investment.estimatedMonthlyRental, currency)}
                </Typography>
              )}
              {investment.mortgagePercentage != null && investment.mortgagePercentage > 0 && (
                <>
                  <Typography variant="body2" color="text.secondary">
                    Mortgage: {investment.mortgagePercentage}% of value
                    ({formatCurrency(investment.estimatedCurrentValue * (investment.mortgagePercentage / 100), currency)})
                    {investment.mortgageInterestRate != null && ` at ${investment.mortgageInterestRate}% interest`}
                    {investment.mortgageTermYears != null && ` for ${investment.mortgageTermYears} years`}
                  </Typography>
                  {investment.estimatedMonthlyMortgage != null && (
                    <Typography variant="body2" color="text.secondary">
                      Est. Monthly Mortgage Payment: {formatCurrency(investment.estimatedMonthlyMortgage, currency)}
                    </Typography>
                  )}
                  {investment.estimatedMonthlyRental != null && investment.estimatedMonthlyRental > 0 && investment.estimatedMonthlyMortgage != null && (() => {
                    const netCashFlow = investment.estimatedMonthlyRental - investment.estimatedMonthlyMortgage;
                    return (
                      <Typography variant="body2" fontWeight="bold" color={netCashFlow >= 0 ? 'success.main' : 'error.main'}>
                        Net Monthly Cash Flow: {netCashFlow >= 0 ? '+' : ''}{formatCurrency(netCashFlow, currency)}
                      </Typography>
                    );
                  })()}
                </>
              )}
            </Box>
          )}
          {investment.rentalIncome && investment.rentalIncome.length > 0 ? (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Month</TableCell>
                  <TableCell align="right">Expected</TableCell>
                  <TableCell align="right">Actual</TableCell>
                  <TableCell>Received</TableCell>
                  <TableCell>Notes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {investment.rentalIncome.map((ri) => (
                  <TableRow key={ri._id}>
                    <TableCell>{ri.month}</TableCell>
                    <TableCell align="right">{formatCurrency(ri.expectedAmount, currency)}</TableCell>
                    <TableCell align="right">
                      {ri.actualAmount != null ? formatCurrency(ri.actualAmount, currency) : '—'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={ri.received ? 'Yes' : 'No'}
                        size="small"
                        color={ri.received ? 'success' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{ri.notes || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Typography variant="body2" color="text.secondary">No rental income records.</Typography>
          )}
          {investment.totalRentalIncome != null && investment.totalRentalIncome > 0 && (
            <Box display="flex" justifyContent="flex-end" mt={1}>
              <Typography variant="body2" color="text.secondary">
                Total Rental Income: {formatCurrency(investment.totalRentalIncome, currency)}
              </Typography>
            </Box>
          )}
        </Paper>
      )}

      {/* Transactions Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" mb={2}>Transactions</Typography>
        {transactions.length > 0 ? (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Category</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transactions.map((txn: any) => (
                <TableRow key={txn._id}>
                  <TableCell>{new Date(txn.date).toLocaleDateString()}</TableCell>
                  <TableCell>{txn.description}</TableCell>
                  <TableCell align="right">
                    {formatCurrency(txn.amount, txn.currency || currency)}
                  </TableCell>
                  <TableCell>{txn.category?.name || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No transactions linked to this investment.
          </Typography>
        )}
      </Paper>

      {/* Dialogs */}
      <RealEstateEditDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        onSuccess={handleEditSuccess}
        investment={investment}
      />

      <CommitmentDialog
        open={commitmentDialogOpen}
        onClose={() => {
          setCommitmentDialogOpen(false);
          setEditingCommitment(null);
        }}
        onSave={handleSaveCommitment}
        commitment={editingCommitment}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Investment</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{investment.name}</strong>? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// ==================== MAIN PAGE ====================

const RealEstate: React.FC = () => {
  const { investmentId } = useParams<{ investmentId: string }>();
  const navigate = useNavigate();

  if (investmentId) {
    return <RealEstateDetail investmentId={investmentId} />;
  }

  return <RealEstateList onNavigateToDetail={(id) => navigate(`/real-estate/${id}`)} />;
};

export default RealEstate;
