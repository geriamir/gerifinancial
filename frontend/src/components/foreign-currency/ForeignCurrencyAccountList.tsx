import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  CircularProgress,
  Alert,
  Skeleton,
  Divider,
  Tooltip
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  AccountBalance as AccountBalanceIcon,
  TrendingUp as TrendingUpIcon,
  SwapHoriz as SwapHorizIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import {
  useForeignCurrencyAccounts,
  useForeignCurrencyFormatters
} from '../../hooks/useForeignCurrency';
import {
  ForeignCurrencyAccountSummary,
  getCurrencySymbol,
  ACCOUNT_STATUSES
} from '../../types/foreignCurrency';
import { encodeAccountNumber } from '../../utils/urlUtils';

interface ForeignCurrencyAccountListProps {
  bankAccountId?: string;
  currency?: string;
  onAccountSelect?: (account: ForeignCurrencyAccountSummary) => void;
}

export const ForeignCurrencyAccountList: React.FC<ForeignCurrencyAccountListProps> = ({
  bankAccountId,
  currency,
  onAccountSelect
}) => {
  const navigate = useNavigate();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedAccount, setSelectedAccount] = useState<ForeignCurrencyAccountSummary | null>(null);

  const { accounts, loading, error, refetch } = useForeignCurrencyAccounts({
    bankAccountId,
    currency
  });

  const { formatAccountBalance, getAccountStatusColor } = useForeignCurrencyFormatters();

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, account: ForeignCurrencyAccountSummary) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setSelectedAccount(account);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedAccount(null);
  };

  const handleAccountClick = (account: ForeignCurrencyAccountSummary) => {
    if (onAccountSelect) {
      onAccountSelect(account);
    } else {
      // URL encode account number to handle slashes and special characters
      const encodedAccountNumber = encodeAccountNumber(account.accountNumber);
      navigate(`/foreign-currency/accounts/${encodedAccountNumber}`);
    }
  };

  const handleViewTransactions = () => {
    if (selectedAccount) {
      // URL encode account number to handle slashes and special characters
      const encodedAccountNumber = encodeAccountNumber(selectedAccount.accountNumber);
      navigate(`/foreign-currency/accounts/${encodedAccountNumber}/transactions`);
    }
    handleMenuClose();
  };

  const handleConvertCurrency = () => {
    if (selectedAccount) {
      navigate(`/foreign-currency/convert?from=${selectedAccount.currency}&to=ILS`);
    }
    handleMenuClose();
  };

  const getStatusChip = (status: 'active' | 'inactive' | 'closed') => {
    const statusConfig = ACCOUNT_STATUSES.find(s => s.value === status);
    return (
      <Chip
        label={statusConfig?.label || status}
        size="small"
        sx={{
          backgroundColor: getAccountStatusColor(status),
          color: 'white',
          fontWeight: 'bold'
        }}
      />
    );
  };

  const AccountCard: React.FC<{ account: ForeignCurrencyAccountSummary }> = ({ account }) => {
    const { primaryBalance, convertedBalance, exchangeRate } = formatAccountBalance(account);
    const currencySymbol = getCurrencySymbol(account.currency);

    return (
      <Card 
        elevation={2}
        sx={{
          height: '100%',
          position: 'relative',
          '&:hover': {
            elevation: 4,
            transform: 'translateY(-2px)',
            transition: 'all 0.2s ease-in-out'
          }
        }}
      >
        <Box sx={{ position: 'relative' }}>
          <CardActionArea onClick={() => handleAccountClick(account)}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                <Box display="flex" alignItems="center">
                  <AccountBalanceIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6" component="h3" noWrap>
                    {currencySymbol} {account.currency}
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={1}>
                  {getStatusChip(account.status)}
                </Box>
              </Box>

            <Box mb={2}>
              <Typography variant="h4" component="div" color="primary.main" gutterBottom>
                {primaryBalance}
              </Typography>
              {convertedBalance && (
                <Typography variant="body2" color="text.secondary">
                  ≈ {convertedBalance}
                </Typography>
              )}
            </Box>

            <Divider sx={{ my: 1.5 }} />

            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="body2" color="text.secondary">
                Transactions
              </Typography>
              <Typography variant="body2" fontWeight="medium">
                {account.transactionCount.toLocaleString()}
              </Typography>
            </Box>

            {account.lastTransactionDate && (
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="body2" color="text.secondary">
                  Last Transaction
                </Typography>
                <Typography variant="body2" fontWeight="medium">
                  {new Date(account.lastTransactionDate).toLocaleDateString()}
                </Typography>
              </Box>
            )}

            {exchangeRate && (
              <Box mt={1}>
                <Tooltip title="Current exchange rate">
                  <Typography variant="caption" color="text.secondary" display="block">
                    {exchangeRate}
                    {account.lastExchangeRateDate && (
                      <span> • {new Date(account.lastExchangeRateDate).toLocaleDateString()}</span>
                    )}
                  </Typography>
                </Tooltip>
              </Box>
            )}
          </CardContent>
        </CardActionArea>
        
        {/* Menu button positioned absolutely to avoid nesting inside CardActionArea */}
        <IconButton
          size="small"
          onClick={(e) => handleMenuOpen(e, account)}
          sx={{ 
            position: 'absolute',
            top: 8,
            right: 8,
            backgroundColor: 'background.paper',
            boxShadow: 1,
            '&:hover': {
              backgroundColor: 'background.default'
            }
          }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Box>
      </Card>
    );
  };

  const LoadingSkeleton: React.FC = () => (
    <Box 
      display="grid" 
      gridTemplateColumns="repeat(auto-fill, minmax(300px, 1fr))" 
      gap={3}
    >
      {[1, 2, 3, 4].map((index) => (
        <Card key={index}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Skeleton variant="text" width={100} height={32} />
              <Skeleton variant="rectangular" width={60} height={24} />
            </Box>
            <Skeleton variant="text" width="80%" height={48} />
            <Skeleton variant="text" width="60%" height={24} />
            <Skeleton variant="text" width="100%" height={20} />
            <Skeleton variant="text" width="100%" height={20} />
          </CardContent>
        </Card>
      ))}
    </Box>
  );

  if (loading && accounts.length === 0) {
    return (
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h5" component="h1">
            Foreign Currency Accounts
          </Typography>
          <IconButton onClick={refetch} disabled>
            <RefreshIcon />
          </IconButton>
        </Box>
        <LoadingSkeleton />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h5" component="h1">
            Foreign Currency Accounts
          </Typography>
          <IconButton onClick={refetch}>
            <RefreshIcon />
          </IconButton>
        </Box>
        <Alert severity="error" action={
          <IconButton color="inherit" size="small" onClick={refetch}>
            <RefreshIcon />
          </IconButton>
        }>
          {error}
        </Alert>
      </Box>
    );
  }

  if (accounts.length === 0) {
    return (
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h5" component="h1">
            Foreign Currency Accounts
          </Typography>
          <IconButton onClick={refetch}>
            <RefreshIcon />
          </IconButton>
        </Box>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <AccountBalanceIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No Foreign Currency Accounts Found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Foreign currency accounts will appear here automatically when detected during bank scraping.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h1">
          Foreign Currency Accounts
          <Typography variant="body2" component="span" color="text.secondary" sx={{ ml: 1 }}>
            ({accounts.length} {accounts.length === 1 ? 'account' : 'accounts'})
          </Typography>
        </Typography>
        <IconButton onClick={refetch} disabled={loading}>
          {loading ? <CircularProgress size={24} /> : <RefreshIcon />}
        </IconButton>
      </Box>

      <Box 
        display="grid" 
        gridTemplateColumns="repeat(auto-fill, minmax(300px, 1fr))" 
        gap={3}
      >
        {accounts.map((account) => (
          <AccountCard key={account.accountNumber} account={account} />
        ))}
      </Box>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        PaperProps={{
          elevation: 3,
          sx: { minWidth: 200 }
        }}
      >
        <MenuItem onClick={handleViewTransactions}>
          <TrendingUpIcon sx={{ mr: 1, fontSize: 20 }} />
          View Transactions
        </MenuItem>
        <MenuItem onClick={handleConvertCurrency}>
          <SwapHorizIcon sx={{ mr: 1, fontSize: 20 }} />
          Convert Currency
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default ForeignCurrencyAccountList;
