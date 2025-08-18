import React from 'react';
import { useParams, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Breadcrumbs,
  Link,
  Chip
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { ForeignCurrencyAccountList } from '../components/foreign-currency/ForeignCurrencyAccountList';
import { ForeignCurrencyTransactionList } from '../components/foreign-currency/ForeignCurrencyTransactionList';
import { useForeignCurrencyAccount } from '../hooks/useForeignCurrency';

const ForeignCurrency: React.FC = () => {
  const { accountNumber } = useParams<{ accountNumber: string }>();
  const location = useLocation();
  
  // Decode the account number if it exists
  const decodedAccountNumber = accountNumber ? decodeURIComponent(accountNumber) : undefined;
  
  // Get account details if viewing specific account
  const { account } = useForeignCurrencyAccount(decodedAccountNumber || null);
  
  // Determine what view to show based on the route
  const isAccountView = location.pathname.includes('/accounts/') && accountNumber;
  const isTransactionView = location.pathname.includes('/transactions');
  const isConvertView = location.pathname.includes('/convert');
  
  // Show account list for main foreign currency page
  if (!isAccountView && !isConvertView) {
    return (
      <Box sx={{ p: 3 }}>
        {/* Page Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Foreign Currency Accounts
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Track your foreign currency accounts, balances, and transactions
          </Typography>
        </Box>

        {/* Main Content */}
        <ForeignCurrencyAccountList />
      </Box>
    );
  }
  
  // Show account details or transactions for specific account
  if (isAccountView && decodedAccountNumber) {
    return (
      <Box sx={{ p: 3 }}>
        {/* Breadcrumbs */}
        <Breadcrumbs sx={{ mb: 3 }}>
          <Link 
            component="button" 
            variant="body2" 
            onClick={() => window.history.back()}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
          >
            <ArrowBackIcon fontSize="small" />
            Foreign Currency
          </Link>
          <Typography variant="body2" color="text.primary">
            Account {decodedAccountNumber}
          </Typography>
        </Breadcrumbs>

        {/* Page Header */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <Typography variant="h4" component="h1">
              {account ? `${account.currency} Account` : 'Loading...'}
            </Typography>
            {account && (
              <Chip 
                label={account.status} 
                size="small"
                color={account.status === 'active' ? 'success' : 'default'}
              />
            )}
          </Box>
          <Typography variant="body1" color="text.secondary">
            Account: {decodedAccountNumber}
          </Typography>
          {account && (
            <Typography variant="body2" color="text.secondary">
              {account.transactionCount} transactions • Balance: {account.balance} {account.currency}
            </Typography>
          )}
        </Box>

        {/* Account Transactions */}
        {isTransactionView ? (
          <ForeignCurrencyTransactionList accountId={decodedAccountNumber} />
        ) : (
          <Box>
            <Typography variant="h6" gutterBottom>
              Recent Transactions
            </Typography>
            <ForeignCurrencyTransactionList accountId={decodedAccountNumber} />
          </Box>
        )}
      </Box>
    );
  }
  
  // Currency converter view (if implemented)
  if (isConvertView) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Currency Converter
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Convert between different currencies
        </Typography>
        {/* TODO: Add currency converter component */}
      </Box>
    );
  }
  
  // Fallback
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Foreign Currency
      </Typography>
      <ForeignCurrencyAccountList />
    </Box>
  );
};

export default ForeignCurrency;
