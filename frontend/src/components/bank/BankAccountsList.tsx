import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  List,
  Paper,
  Stack,
  Typography
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { bankAccountsApi } from '../../services/api/bank';
import { BankAccount } from '../../services/api/types';
import { SUPPORTED_BANKS } from '../../constants/banks';
import { BankAccountForm } from './BankAccountForm';
import { track } from '../../utils/analytics';
import { BANK_ACCOUNT_EVENTS } from '../../constants/analytics';
import { ScrapeAllAccounts } from './ScrapeAllAccounts';
import { AccountScraping } from './AccountScraping';

const getStatusColor = (status: BankAccount['status']) => {
  switch (status) {
    case 'active':
      return 'success';
    case 'error':
      return 'error';
    case 'pending':
      return 'warning';
    case 'disabled':
      return 'default';
    default:
      return 'default';
  }
};

export const BankAccountsList: React.FC = () => {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const fetchAccounts = async () => {
    try {
      const data = await bankAccountsApi.getAll();
      setAccounts(data);
      setError('');
    } catch (err) {
      setError('Failed to load bank accounts');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    track(BANK_ACCOUNT_EVENTS.VIEW_LIST);
    fetchAccounts();
  }, []);

  const handleTestConnection = async (accountId: string, bankName: string) => {
    track(BANK_ACCOUNT_EVENTS.TEST_CONNECTION, { accountId, bankName });
    try {
      await bankAccountsApi.test(accountId);
      track(BANK_ACCOUNT_EVENTS.TEST_CONNECTION_SUCCESS, { accountId, bankName });
      await fetchAccounts(); // Refresh to get updated status
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Test connection failed';
      console.error(errorMessage);
      track(BANK_ACCOUNT_EVENTS.TEST_CONNECTION_ERROR, { 
        accountId, 
        bankName,
        error: errorMessage 
      });
    }
  };

  const handleDelete = async (accountId: string, bankName: string) => {
    if (!window.confirm('Are you sure you want to delete this bank account?')) {
      return;
    }

    track(BANK_ACCOUNT_EVENTS.DELETE, { accountId, bankName });
    try {
      await bankAccountsApi.delete(accountId);
      track(BANK_ACCOUNT_EVENTS.DELETE_SUCCESS, { accountId, bankName });
      setAccounts(accounts.filter(account => account._id !== accountId));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Delete failed';
      console.error(errorMessage);
      track(BANK_ACCOUNT_EVENTS.DELETE_ERROR, { 
        accountId, 
        bankName,
        error: errorMessage 
      });
    }
  };

  const getBankName = (bankId: string) => {
    const bank = SUPPORTED_BANKS.find(bank => bank.id === bankId);
    return bank ? bank.name : bankId;
  };

  if (loading) {
    return <Typography>Loading accounts...</Typography>;
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">Bank Accounts</Typography>
        <Stack direction="row" spacing={2}>
          <ScrapeAllAccounts
            disabled={accounts.length === 0}
            onScrapingComplete={fetchAccounts}
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              track(BANK_ACCOUNT_EVENTS.OPEN_ADD_FORM);
              setShowAddForm(true);
            }}
          >
            Add Bank Account
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Typography color="error" mb={2}>
          {error}
        </Typography>
      )}

      {accounts.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="textSecondary">
            No bank accounts added yet. Click the button above to add your first account.
          </Typography>
        </Paper>
      ) : (
        <List>
          {accounts.map(account => (
            <Card key={account._id} sx={{ mb: 2 }}>
              <CardContent>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Box>
                    <Typography variant="h6" sx={{ mb: 0.5 }}>{account.name}</Typography>
                    <Typography color="textSecondary" variant="body2">
                      {getBankName(account.bankId)}
                    </Typography>
                    {account.lastError && (
                      <Typography color="error" variant="caption" display="block" sx={{ mb: 1 }}>
                        Error: {account.lastError.message}
                      </Typography>
                    )}
                    <AccountScraping
                      accountId={account._id}
                      lastScraped={account.lastScraped}
                      isDisabled={account.status !== 'active'}
                      onScrapingComplete={fetchAccounts}
                    />
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      label={account.status}
                      color={getStatusColor(account.status)}
                      size="small"
                    />
                    <IconButton
                      onClick={() => handleTestConnection(account._id, getBankName(account.bankId))}
                      title="Test Connection"
                      aria-label={`Test connection for ${account.name}`}
                      size="small"
                    >
                      <RefreshIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => handleDelete(account._id, getBankName(account.bankId))}
                      title="Delete Account"
                      aria-label={`Delete ${account.name}`}
                      size="small"
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </List>
      )}

      <BankAccountForm
        open={showAddForm}
        onClose={() => setShowAddForm(false)}
        onSuccess={fetchAccounts}
      />
    </Box>
  );
};
