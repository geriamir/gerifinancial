import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Alert,
  Stack,
  CircularProgress,
  AlertTitle,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { Keyboard as KeyboardIcon } from '@mui/icons-material';
import { PendingTransactionList } from '../components/transactions/PendingTransactionList';
import { ProcessingStats } from '../components/transactions/ProcessingStats';
import { transactionsApi } from '../services/api/transactions';
import type { PendingTransaction, ProcessingStats as IProcessingStats } from '../services/api/types/transactions';
import { useAnalytics } from '../hooks/useAnalytics';
import { useVerificationPageKeyboard } from '../hooks/useVerificationPageKeyboard';
import { useTutorialGuide } from '../hooks/useTutorialGuide';
import { useAuth } from '../hooks/useAuth';

const PAGE_SIZE = 20;

const initialStats: IProcessingStats = {
  pending: 0,
  verified: 0,
  total: 0
};

export const PendingTransactions: React.FC = () => {
  const [transactions, setTransactions] = useState<PendingTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState<IProcessingStats>(initialStats);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  
  const { trackEvent } = useAnalytics();
  const { isAuthenticated, token } = useAuth();

  // Debug log
  useEffect(() => {
    console.log('Auth state:', { isAuthenticated, hasToken: !!token });
  }, [isAuthenticated, token]);

  // Tutorial guide integration
  const { 
    currentStep,
    isCompleted,
    goToNextStep,
    skipTutorial,
    resetTutorial,
    totalSteps,
    tutorialSteps
  } = useTutorialGuide({
    onComplete: () => {
      console.log('Tutorial completed!');
    }
  });

  // Set up keyboard shortcuts
  const handleOpenBatch = () => {
    // TODO: Implement batch verification dialog open
    console.log('Opening batch verification...');
  };

  const handleConfirmVerification = () => {
    // TODO: Implement single transaction verification
    console.log('Confirming verification...');
  };

  const { registerShortcuts, unregisterShortcuts } = useVerificationPageKeyboard({
    onOpenBatch: handleOpenBatch,
    onConfirm: handleConfirmVerification,
    isEnabled: !loading
  });

  useEffect(() => {
    registerShortcuts();
    return () => unregisterShortcuts();
  }, [registerShortcuts, unregisterShortcuts]);

  const loadTransactions = useCallback(async (pageNum: number = 1, showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);

      const params = {
        limit: PAGE_SIZE,
        skip: (pageNum - 1) * PAGE_SIZE
      };

      console.log('Fetching transactions with params:', params);
      const response = await transactionsApi.getPendingTransactions(params);
      console.log('Received transactions:', response);

      if (pageNum === 1) {
        setTransactions(response.transactions);
      } else {
        setTransactions(prev => [...prev, ...response.transactions]);
      }
      
      setHasMore(response.hasMore);
      setPage(pageNum);
    } catch (err) {
      console.error('Error loading transactions:', err);
      setError('Failed to load pending transactions. Please try again.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setStatsLoading(true);
      const stats = await transactionsApi.getProcessingStats();
      setStats(stats);
      trackEvent('stats_loaded', { ...stats });
    } catch (err) {
      console.error('Failed to load processing stats:', err);
      // Don't show error UI for stats - they're not critical
    } finally {
      if (showLoading) setStatsLoading(false);
    }
  }, [trackEvent]);

  // Initial load
  useEffect(() => {
    const loadInitialData = async () => {
      await Promise.all([
        loadTransactions(1, true),
        loadStats(true)
      ]);
    };
    loadInitialData();
  }, [loadTransactions, loadStats]);

  // Periodic stats refresh
  useEffect(() => {
    const interval = setInterval(() => {
      loadStats(false);
    }, 30000); // Refresh stats every 30 seconds

    return () => clearInterval(interval);
  }, [loadStats]);

  const handleVerify = async (transactionId: string) => {
    try {
      setError(null);
      await transactionsApi.verifyTransaction(transactionId);
      
      // Update local state
      setTransactions(prev =>
        prev.filter(transaction => transaction._id !== transactionId)
      );
      
      // Track analytics
      trackEvent('transaction_verified', { transactionId, success: true });
      
      // Refresh stats without loading indicator
      loadStats(false);
    } catch (err) {
      trackEvent('transaction_verified', { transactionId, success: false });
      setError('Failed to verify transaction. Please try again.');
      console.error('Error verifying transaction:', err);
    }
  };

  const handleCategoryUpdate = async () => {
    // Refresh the transactions list to show updated categories
    loadTransactions(page, false);
    // Refresh stats
    loadStats(false);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadTransactions(page + 1);
    }
  };

  const handleRetry = () => {
    loadTransactions(1);
    loadStats();
  };

  const toggleKeyboardHelp = () => {
    setShowKeyboardHelp(!showKeyboardHelp);
  };

  const currentStepIndex = currentStep 
    ? tutorialSteps.findIndex(step => step.id === currentStep.id)
    : -1;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={4}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h4" gutterBottom>
            Pending Transactions
          </Typography>
          <Box>
            {!isCompleted && (
              <Button
                size="small"
                onClick={resetTutorial}
                sx={{ mr: 2 }}
              >
                Restart Tutorial
              </Button>
            )}
            <Tooltip title="Keyboard shortcuts (?)">
              <IconButton
                onClick={toggleKeyboardHelp}
                color="primary"
                aria-label="Show keyboard shortcuts"
                className="keyboard-shortcuts-button"
              >
                <KeyboardIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Stack>

        <Box className="processing-stats">
          <ProcessingStats
            stats={stats}
            loading={statsLoading}
          />
        </Box>

        {error && (
          <Alert 
            severity="error" 
            action={
              <Button color="inherit" size="small" onClick={handleRetry}>
                Retry
              </Button>
            }
          >
            <AlertTitle>Error</AlertTitle>
            {error}
          </Alert>
        )}

        {loading && transactions.length === 0 ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : transactions.length > 0 ? (
          <Box className="transaction-list">
            <PendingTransactionList
              transactions={transactions}
              onVerify={handleVerify}
              onLoadMore={handleLoadMore}
              hasMore={hasMore}
              loading={loading}
              onCategoryUpdate={handleCategoryUpdate}
            />
          </Box>
        ) : !error && (
          <Alert severity="success">
            No pending transactions! 🎉
          </Alert>
        )}

        {showKeyboardHelp && (
          <Dialog onClose={() => setShowKeyboardHelp(false)} open>
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
            <DialogContent>
              <Typography>
                <pre>
                  ?: Show/hide this help
                  Space/Enter: Verify selected transaction
                  ↑/↓: Navigate transactions
                  Tab: Move between actions
                </pre>
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowKeyboardHelp(false)}>Close</Button>
            </DialogActions>
          </Dialog>
        )}

        {currentStep && (
          <Dialog open>
            <DialogTitle>Tutorial</DialogTitle>
            <DialogContent>
              <Typography>{currentStep.content}</Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={skipTutorial}>Skip</Button>
              <Button onClick={goToNextStep}>
                {currentStepIndex === totalSteps - 1 ? 'Finish' : 'Next'}
              </Button>
            </DialogActions>
          </Dialog>
        )}
      </Stack>
    </Container>
  );
};
