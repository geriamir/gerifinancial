import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
  Fade,
  CircularProgress
} from '@mui/material';
import {
  CloudSync as CloudSyncIcon,
  Download as DownloadIcon,
  Psychology as PsychologyIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { onboardingApi, TransactionImportStatus } from '../../services/api/onboarding';
import { useOnboarding } from '../../hooks/useOnboarding';

interface TransactionImportProps {
  onComplete: () => void;
  bankAccountId?: string;
  stepData?: any;
}

const TransactionImport: React.FC<TransactionImportProps> = ({ onComplete, bankAccountId, stepData }) => {
  const [status, setStatus] = useState<TransactionImportStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const { updateOnboardingStatus } = useOnboarding();
  
  // Use refs to prevent multiple intervals and callback recreation
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const onCompleteRef = useRef(onComplete);
  const updateOnboardingStatusRef = useRef(updateOnboardingStatus);
  
  // Update refs when props change
  useEffect(() => {
    onCompleteRef.current = onComplete;
    updateOnboardingStatusRef.current = updateOnboardingStatus;
  }, [onComplete, updateOnboardingStatus]);

  // Stable poll function that doesn't change
  const pollStatus = useCallback(async () => {
    try {
      const currentStatus = await onboardingApi.getScrapingStatus();
      setStatus(currentStatus);
      setError(null);

      // Handle completion
      if (currentStatus.status === 'complete') {
        // Mark transaction-import step as completed
        await updateOnboardingStatusRef.current('transaction-import');
        
        // Stop polling
        setIsPolling(false);
        
        // Clear any existing interval
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        
        // Auto-advance to next step after a brief delay
        setTimeout(() => {
          onCompleteRef.current();
        }, 2000);
      } else if (currentStatus.status === 'error') {
        setError(currentStatus.error || 'Transaction import failed');
        setIsPolling(false);
        
        // Clear any existing interval
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else if (currentStatus.status === 'not_started') {
        setError('Transaction import has not been started. Please try connecting your bank account again.');
        setIsPolling(false);
        
        // Clear any existing interval
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to get import status');
      setIsPolling(false);
      
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, []); // No dependencies - using refs instead

  // Single effect to handle all polling logic
  useEffect(() => {
    // Initial status check
    pollStatus();

    // Set up polling interval if needed
    if (isPolling && !intervalRef.current) {
      intervalRef.current = setInterval(pollStatus, 15000); // Poll every 15 seconds
    } else if (!isPolling && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPolling, pollStatus]);

  // Get current stage information
  const getCurrentStageInfo = () => {
    if (!status) {
      return {
        icon: <CircularProgress size={24} />,
        text: 'Checking status...',
        description: 'Getting the latest import status...'
      };
    }

    switch (status.status) {
      case 'connecting':
        return {
          icon: <CloudSyncIcon color="primary" />,
          text: 'Connecting to Bank',
          description: status.message || 'Logging into your bank account...'
        };
      case 'scraping':
        return {
          icon: <DownloadIcon color="primary" />,
          text: 'Importing Transactions',
          description: status.message || 'Downloading transactions from the last 6 months...'
        };
      case 'categorizing':
        return {
          icon: <PsychologyIcon color="primary" />,
          text: 'AI Categorization',
          description: status.message || 'Categorizing transactions using AI...'
        };
      case 'complete':
        return {
          icon: <CheckCircleIcon color="success" />,
          text: 'Import Complete',
          description: status.message || 'Successfully imported and categorized your transactions'
        };
      case 'error':
        return {
          icon: <ErrorIcon color="error" />,
          text: 'Import Failed',
          description: status.error || 'An error occurred during import'
        };
      case 'not_started':
        return {
          icon: <ErrorIcon color="warning" />,
          text: 'Import Not Started',
          description: 'Transaction import has not been initiated'
        };
      default:
        return {
          icon: <CloudSyncIcon />,
          text: 'Processing...',
          description: status.message || 'Working on your transaction import...'
        };
    }
  };

  const stageInfo = getCurrentStageInfo();
  const progress = status?.progress || 0;
  const isComplete = status?.status === 'complete';
  const hasError = !!error || (status?.status === 'error') || (status?.status === 'not_started');

  return (
    <Fade in timeout={500}>
      <Box sx={{ maxWidth: 600, mx: 'auto' }}>
        <Paper elevation={2} sx={{ p: 4 }}>
          <Typography variant="h5" gutterBottom align="center">
            Transaction Import
          </Typography>
          
          <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 4 }}>
            Your transaction import started automatically when you connected your bank account.
            We're importing your transactions and using AI to categorize them.
          </Typography>

          {hasError && (
            <Alert severity="error" sx={{ mb: 3 }}>
              <Typography variant="subtitle2">Import Issue</Typography>
              <Typography variant="body2">
                {error || status?.error}
              </Typography>
            </Alert>
          )}

          {!hasError && (
            <>
              {/* Progress Bar */}
              <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Progress: {progress}%
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={progress}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>

              {/* Current Stage */}
              <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 40 }}>
                    {stageInfo.icon}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {stageInfo.text}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {stageInfo.description}
                    </Typography>
                  </Box>
                </Box>
              </Paper>

              {/* Statistics */}
              {status && (status.transactionsImported > 0 || status.transactionsCategorized > 0) && (
                <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Import Statistics
                  </Typography>
                  <List dense disablePadding>
                    <ListItem disablePadding>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <DownloadIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={`${status.transactionsImported} transactions imported`}
                      />
                    </ListItem>
                    {status.transactionsCategorized > 0 && (
                      <ListItem disablePadding>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <PsychologyIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText 
                          primary={`${status.transactionsCategorized} transactions categorized`}
                        />
                      </ListItem>
                    )}
                  </List>
                </Paper>
              )}

              {/* Success Message */}
              {isComplete && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  <Typography variant="subtitle2">Import Successful!</Typography>
                  <Typography variant="body2">
                    {status?.transactionsImported || 0} transactions have been imported and categorized.
                    Moving to the next step...
                  </Typography>
                </Alert>
              )}
            </>
          )}

          {/* Process Steps Preview */}
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" gutterBottom color="text.secondary">
              Import Process:
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon>
                  <CloudSyncIcon 
                    color={status?.status === 'connecting' ? 'primary' : 
                           progress > 10 ? 'success' : 'disabled'} 
                  />
                </ListItemIcon>
                <ListItemText 
                  primary="Connect to your bank"
                  secondary="Securely log into your bank account"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <DownloadIcon 
                    color={status?.status === 'scraping' ? 'primary' : 
                           progress > 60 ? 'success' : 'disabled'} 
                  />
                </ListItemIcon>
                <ListItemText 
                  primary="Import transactions"
                  secondary="Download the last 6 months of transactions"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <PsychologyIcon 
                    color={status?.status === 'categorizing' ? 'primary' : 
                           progress === 100 ? 'success' : 'disabled'} 
                  />
                </ListItemIcon>
                <ListItemText 
                  primary="AI categorization"
                  secondary="Automatically categorize transactions using AI"
                />
              </ListItem>
            </List>
          </Box>
        </Paper>
      </Box>
    </Fade>
  );
};

export default TransactionImport;
