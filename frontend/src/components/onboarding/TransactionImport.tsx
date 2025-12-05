import React from 'react';
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
import { OnboardingStatus } from '../../services/api/onboarding';

interface TransactionImportProps {
  onComplete?: () => void;
  importStatus?: {
    completed: boolean;
    transactionsImported: number;
    completedAt: string | null;
    scrapingStatus: {
      isActive: boolean;
      status: string | null;
      progress: number;
      message: string | null;
      error: string | null;
    };
  };
  scrapingStatus?: {
    isActive: boolean;
    status: string | null;
    progress: number;
    message: string | null;
    error: string | null;
  };
  stepData?: OnboardingStatus;
}

const TransactionImport: React.FC<TransactionImportProps> = ({ 
  importStatus,
  scrapingStatus: propScrapingStatus,
  stepData 
}) => {
  // Use provided scraping status from props (real-time from hook polling)
  const scrapingStatus = propScrapingStatus || importStatus?.scrapingStatus;
  
  if (!scrapingStatus) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Loading status...
        </Typography>
      </Box>
    );
  }

  // Get current stage information
  const getCurrentStageInfo = () => {
    if (!scrapingStatus) {
      return {
        icon: <CircularProgress size={24} />,
        text: 'Checking status...',
        description: 'Getting the latest import status...'
      };
    }

    const status = scrapingStatus.status;
    
    switch (status) {
      case 'connecting':
        return {
          icon: <CloudSyncIcon color="primary" />,
          text: 'Connecting to Bank',
          description: scrapingStatus.message || 'Logging into your bank account...'
        };
      case 'scraping':
      case 'in-progress':
        return {
          icon: <DownloadIcon color="primary" />,
          text: 'Importing Transactions',
          description: scrapingStatus.message || 'Downloading transactions from the last 6 months...'
        };
      case 'categorizing':
        return {
          icon: <PsychologyIcon color="primary" />,
          text: 'AI Categorization',
          description: scrapingStatus.message || 'Categorizing transactions using AI...'
        };
      case 'complete':
        return {
          icon: <CheckCircleIcon color="success" />,
          text: 'Import Complete',
          description: scrapingStatus.message || 'Successfully imported and categorized your transactions'
        };
      case 'error':
      case 'failed':
        return {
          icon: <ErrorIcon color="error" />,
          text: 'Import Failed',
          description: scrapingStatus.error || scrapingStatus.message || 'An error occurred during import'
        };
      default:
        return {
          icon: <CloudSyncIcon />,
          text: 'Processing...',
          description: scrapingStatus.message || 'Working on your transaction import...'
        };
    }
  };

  const stageInfo = getCurrentStageInfo();
  const progress = scrapingStatus.progress || 0;
  const isComplete = scrapingStatus.status === 'complete' || importStatus?.completed;
  const hasError = scrapingStatus.status === 'error' || scrapingStatus.status === 'failed' || !!scrapingStatus.error;
  const isActive = scrapingStatus.isActive;
  const transactionsImported = importStatus?.transactionsImported || 0;

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
                {scrapingStatus.error || scrapingStatus.message || 'An error occurred during import'}
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
                  {isActive && (
                    <Typography variant="body2" color="primary" sx={{ ml: 'auto' }}>
                      Processing...
                    </Typography>
                  )}
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
              {transactionsImported > 0 && (
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
                        primary={`${transactionsImported} transactions imported`}
                      />
                    </ListItem>
                  </List>
                </Paper>
              )}

              {/* Success Message */}
              {isComplete && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  <Typography variant="subtitle2">Import Successful!</Typography>
                  <Typography variant="body2">
                    {transactionsImported} transactions have been imported and categorized.
                    {isActive ? ' Processing credit card detection...' : ' Moving to the next step...'}
                  </Typography>
                </Alert>
              )}

              {/* Still Processing */}
              {isActive && !isComplete && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="subtitle2">Import in Progress</Typography>
                  <Typography variant="body2">
                    This page will automatically update as the import progresses. 
                    You can safely wait here or come back later.
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
                    color={scrapingStatus.status === 'connecting' ? 'primary' : 
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
                    color={scrapingStatus.status === 'scraping' || scrapingStatus.status === 'in-progress' ? 'primary' : 
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
                    color={scrapingStatus.status === 'categorizing' ? 'primary' : 
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
