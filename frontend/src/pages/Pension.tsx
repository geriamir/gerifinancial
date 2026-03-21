import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ArrowBack as ArrowBackIcon,
  Sync as SyncIcon,
  AccountBalance as AccountBalanceIcon
} from '@mui/icons-material';
import { pensionApi } from '../services/api/pension';
import {
  PensionAccount,
  PensionSummary,
  PensionSummaryGroup,
  PRODUCT_TYPE_LABELS,
  PRODUCT_TYPE_COLORS
} from '../services/api/types/pension';

const formatCurrency = (amount: number | null, currency = 'ILS'): string => {
  if (amount == null) return '—';
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const formatPercent = (value: number | null): string => {
  if (value == null) return '—';
  return `${value.toFixed(2)}%`;
};

// ─── Account Detail View ────────────────────────────────────────
interface AccountDetailProps {
  account: PensionAccount;
  onBack: () => void;
}

const AccountDetail: React.FC<AccountDetailProps> = ({ account, onBack }) => {
  const activeRoutes = account.investmentRoutes?.filter(r => r.isActive && r.amount > 0) || [];

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ mb: 2 }}>
        Back to Summary
      </Button>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h5">{account.policyName}</Typography>
        <Chip
          label={PRODUCT_TYPE_LABELS[account.productType] || account.productType}
          sx={{ backgroundColor: PRODUCT_TYPE_COLORS[account.productType], color: 'white' }}
          size="small"
        />
      </Box>

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
        {/* Left: Main Info */}
        <Box sx={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Balance Card */}
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">Total Balance</Typography>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {formatCurrency(account.balance)}
              </Typography>
              {account.employerName && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Employer: {account.employerName}
                </Typography>
              )}
              {account.accountNumber && (
                <Typography variant="body2" color="text.secondary">
                  Account: {account.accountNumber}
                </Typography>
              )}
              {account.lastSynced && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Last synced: {new Date(account.lastSynced).toLocaleDateString('he-IL')}
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Investment Routes */}
          {activeRoutes.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Investment Routes</Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Route</TableCell>
                        <TableCell align="right">Allocation</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell align="right">Yield</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {activeRoutes.map((route, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{route.name}</TableCell>
                          <TableCell align="right">{formatPercent(route.allocationPercent)}</TableCell>
                          <TableCell align="right">{formatCurrency(route.amount)}</TableCell>
                          <TableCell align="right" sx={{
                            color: route.yieldPercent != null
                              ? route.yieldPercent >= 0 ? 'success.main' : 'error.main'
                              : 'text.secondary'
                          }}>
                            {formatPercent(route.yieldPercent)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}

          {/* Yearly Transactions */}
          {account.yearlyTransactions?.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Yearly Transactions</Typography>
                {account.yearlyTransactions.map((yearData, idx) => (
                  <Accordion key={idx} defaultExpanded={idx === 0}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
                        {yearData.year}
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Table size="small">
                        <TableBody>
                          {yearData.items.map((item, jdx) => (
                            <TableRow key={jdx}>
                              <TableCell>
                                <Typography variant="body2">{item.title}</Typography>
                                {item.subTitle && (
                                  <Typography variant="caption" color="text.secondary">
                                    {item.subTitle}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell align="right" sx={{
                                color: item.amount != null
                                  ? item.amount >= 0 ? 'success.main' : 'error.main'
                                  : 'text.secondary',
                                fontWeight: 'medium'
                              }}>
                                {formatCurrency(item.amount)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </CardContent>
            </Card>
          )}
        </Box>

        {/* Right: Sidebar */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Management Fees */}
          {(account.managementFee?.fromDeposit != null || account.managementFee?.fromSaving != null) && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Management Fees</Typography>
                {account.managementFee.fromDeposit != null && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">From Deposit</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                      {formatPercent(account.managementFee.fromDeposit)}
                    </Typography>
                  </Box>
                )}
                {account.managementFee.fromSaving != null && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">From Savings</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                      {formatPercent(account.managementFee.fromSaving)}
                    </Typography>
                  </Box>
                )}
                {account.managementFee.validUntil && (
                  <Typography variant="caption" color="text.secondary">
                    Valid until: {new Date(account.managementFee.validUntil).toLocaleDateString('he-IL')}
                  </Typography>
                )}
              </CardContent>
            </Card>
          )}

          {/* Expected Payments */}
          {account.expectedPayments?.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Expected Payments</Typography>
                {account.expectedPayments.map((payment, idx) => (
                  <Box key={idx} sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'medium' }}>{payment.title}</Typography>
                    {payment.subTitle && (
                      <Typography variant="caption" color="text.secondary">{payment.subTitle}</Typography>
                    )}
                    <Typography variant="body1" sx={{ fontWeight: 'bold', mt: 0.5 }}>
                      {formatCurrency(payment.amount)}
                    </Typography>
                    {idx < account.expectedPayments.length - 1 && <Divider sx={{ mt: 1 }} />}
                  </Box>
                ))}
              </CardContent>
            </Card>
          )}
        </Box>
      </Box>
    </Box>
  );
};

// ─── Sync Dialog ────────────────────────────────────────────────
interface SyncDialogProps {
  open: boolean;
  onClose: () => void;
  onSyncComplete: () => void;
}

const SyncDialog: React.FC<SyncDialogProps> = ({ open, onClose, onSyncComplete }) => {
  const [step, setStep] = useState<'config' | 'otp' | 'syncing' | 'done'>('config');
  const [bankAccountId, setBankAccountId] = useState('');
  const [otpDestination, setOtpDestination] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ synced: number; errors: string[] } | null>(null);

  const handleInitiateOtp = async () => {
    try {
      setError(null);
      const response = await pensionApi.initiateOtp(bankAccountId);
      setOtpDestination(response.destination || '');
      setStep('otp');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleVerify = async () => {
    try {
      setError(null);
      setStep('syncing');
      const syncResult = await pensionApi.verifyAndSync(bankAccountId, otp);
      setResult({ synced: syncResult.synced, errors: syncResult.errors });
      setStep('done');
      onSyncComplete();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
      setStep('otp');
    }
  };

  const handleClose = () => {
    setStep('config');
    setOtp('');
    setOtpDestination('');
    setError(null);
    setResult(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Sync Phoenix Insurance (הפניקס)</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {step === 'config' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Phoenix Bank Account ID"
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              helperText="The bank account ID configured for Phoenix"
              fullWidth
            />
          </Box>
        )}

        {step === 'otp' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Typography>
              Enter the OTP code sent to {otpDestination || 'your phone/email'}:
            </Typography>
            <TextField
              label="OTP Code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              autoFocus
              fullWidth
            />
          </Box>
        )}

        {step === 'syncing' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
            <CircularProgress size={48} />
            <Typography sx={{ mt: 2 }}>Syncing Phoenix data...</Typography>
          </Box>
        )}

        {step === 'done' && result && (
          <Box sx={{ mt: 1 }}>
            <Alert severity="success">
              Successfully synced {result.synced} pension accounts.
            </Alert>
            {result.errors.length > 0 && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                {result.errors.length} error(s) occurred during sync.
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>
          {step === 'done' ? 'Close' : 'Cancel'}
        </Button>
        {step === 'config' && (
          <Button variant="contained" onClick={handleInitiateOtp} disabled={!bankAccountId}>
            Send OTP
          </Button>
        )}
        {step === 'otp' && (
          <Button variant="contained" onClick={handleVerify} disabled={!otp}>
            Verify & Sync
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

// ─── Main Pension Page ──────────────────────────────────────────
const Pension: React.FC = () => {
  const [summary, setSummary] = useState<PensionSummary | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<PensionAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await pensionApi.getSummary();
      setSummary(data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load pension data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAccountClick = async (accountId: string) => {
    try {
      const account = await pensionApi.getAccount(accountId);
      setSelectedAccount(account);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load account details');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={48} />
      </Box>
    );
  }

  // Detail view
  if (selectedAccount) {
    return (
      <Box sx={{ p: 3 }}>
        <AccountDetail account={selectedAccount} onBack={() => setSelectedAccount(null)} />
      </Box>
    );
  }

  const hasAccounts = summary && summary.groups.length > 0;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Pension & Savings
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Track your pension funds, provident funds, and insurance savings
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<SyncIcon />}
          onClick={() => setSyncDialogOpen(true)}
        >
          Sync Phoenix
        </Button>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {!hasAccounts ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <AccountBalanceIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>No Pension Accounts</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Connect your Phoenix Insurance account to start tracking your pension and savings.
            </Typography>
            <Button variant="contained" startIcon={<SyncIcon />} onClick={() => setSyncDialogOpen(true)}>
              Connect Phoenix
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Total Balance Card */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">Total Pension & Savings</Typography>
              <Typography variant="h3" sx={{ fontWeight: 'bold', my: 1 }}>
                {formatCurrency(summary!.totalBalance)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {summary!.groups.reduce((sum, g) => sum + g.accountCount, 0)} accounts across{' '}
                {summary!.groups.length} categories
              </Typography>
            </CardContent>
          </Card>

          {/* Category Cards */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {summary!.groups.map((group: PensionSummaryGroup) => (
              <Card key={group.productType}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        backgroundColor: PRODUCT_TYPE_COLORS[group.productType]
                      }} />
                      <Typography variant="h6">
                        {PRODUCT_TYPE_LABELS[group.productType] || group.productType}
                      </Typography>
                      <Chip label={`${group.accountCount} accounts`} size="small" variant="outlined" />
                    </Box>
                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                      {formatCurrency(group.totalBalance)}
                    </Typography>
                  </Box>

                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Account</TableCell>
                          <TableCell>Provider</TableCell>
                          <TableCell>Employer</TableCell>
                          <TableCell align="right">Balance</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {group.accounts.map((acc) => (
                          <TableRow
                            key={acc._id}
                            hover
                            sx={{ cursor: 'pointer' }}
                            onClick={() => handleAccountClick(acc._id)}
                          >
                            <TableCell>{acc.policyName}</TableCell>
                            <TableCell>
                              <Chip label={acc.provider} size="small" />
                            </TableCell>
                            <TableCell>{acc.employerName || '—'}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'medium' }}>
                              {formatCurrency(acc.balance)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            ))}
          </Box>
        </>
      )}

      <SyncDialog
        open={syncDialogOpen}
        onClose={() => setSyncDialogOpen(false)}
        onSyncComplete={loadData}
      />
    </Box>
  );
};

export default Pension;
