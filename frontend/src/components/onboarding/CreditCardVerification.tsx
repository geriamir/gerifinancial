import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  LinearProgress,
  Divider
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Schedule as ScheduleIcon,
  Receipt as ReceiptIcon,
  Warning as WarningIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { OnboardingStepProps } from './OnboardingWizard';
import { 
  onboardingApi, 
  TransactionImportStatus, 
  CoverageAnalysis 
} from '../../services/api/onboarding';

export const CreditCardVerification: React.FC<OnboardingStepProps> = ({
  onComplete,
  stepData
}) => {
  const [scrapingStatus, setScrapingStatus] = useState<TransactionImportStatus | null>(null);
  const [coverageAnalysis, setCoverageAnalysis] = useState<CoverageAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysisComplete, setAnalysisComplete] = useState(false);

  // Get the bank account ID from step data or from connected bank accounts
  const bankAccountId = stepData?.bankAccountId || stepData?.transitionData?.bankAccountId;

  // Poll for scraping status
  const pollScrapingStatus = useCallback(async () => {
    try {
      const status = await onboardingApi.getScrapingStatus();
      setScrapingStatus(status);

      // If scraping is complete, has imported transactions, AND has categorized them, then analyze coverage
      if (status.status === 'complete' && 
          status.hasImportedTransactions && 
          status.transactionsCategorized > 0 &&
          !analysisComplete) {
        
        // Add a small delay to ensure all backend processing is fully complete
        setTimeout(async () => {
          await performCoverageAnalysis();
        }, 2000);
      }
    } catch (error) {
      console.error('Error polling scraping status:', error);
      // If there's an error getting status, set a basic error state
      if (!scrapingStatus) {
        setError('Unable to get import status. Please try refreshing the page.');
        setLoading(false);
      }
    }
  }, [analysisComplete, scrapingStatus]);

  // Perform coverage analysis once scraping is complete
  const performCoverageAnalysis = async () => {
    try {
      setLoading(true);
      
      // Analyze coverage of credit card transactions
      const coverageData = await onboardingApi.analyzeCoverage();
      setCoverageAnalysis(coverageData);
      setAnalysisComplete(true);
    } catch (error) {
      console.error('Coverage analysis failed:', error);
      setError('Failed to analyze credit card coverage');
    } finally {
      setLoading(false);
    }
  };

  // Start polling when component mounts
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    const initializeComponent = async () => {
      try {
        // Initial status check
        await pollScrapingStatus();

        // Poll every 15 seconds while scraping is active
        interval = setInterval(pollScrapingStatus, 15000);
      } catch (error) {
        console.error('Error initializing verification component:', error);
        setError('Failed to initialize credit card verification');
        setLoading(false);
      }
    };

    initializeComponent();

    // Cleanup function
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, []); // Remove pollScrapingStatus from dependencies to prevent infinite re-creation

  const handleConnectMoreCards = () => {
    // Go back to credit card setup to connect more accounts
    onComplete('credit-card-setup', {
      ...stepData,
      needsMoreCards: true,
      currentCoverage: coverageAnalysis
    });
  };

  const handleCompleteOnboarding = () => {
    onComplete('complete', {
      ...stepData,
      creditCardCoverage: coverageAnalysis,
      verificationComplete: true
    });
  };

  const handleRetryAnalysis = () => {
    setError(null);
    setAnalysisComplete(false);
    setCoverageAnalysis(null);
    setLoading(true);
    pollScrapingStatus();
  };

  if (error && !scrapingStatus) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="subtitle2">Verification Failed</Typography>
          <Typography variant="body2">{error}</Typography>
        </Alert>
        
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
          <Button onClick={handleRetryAnalysis} variant="outlined">
            Try Again
          </Button>
          <Button onClick={handleCompleteOnboarding} variant="text">
            Skip Verification
          </Button>
        </Box>
      </Box>
    );
  }

  // Still waiting for scraping to complete
  if (!analysisComplete || !coverageAnalysis) {
    return (
      <Box>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <ScheduleIcon color="primary" sx={{ fontSize: 64, mb: 2 }} />
          <Typography variant="h5" component="h2" gutterBottom>
            Verifying Credit Card Coverage
          </Typography>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            We're importing transactions from your new credit card account and analyzing 
            which transactions are now covered.
          </Typography>
        </Box>

        {/* Scraping Progress */}
        {scrapingStatus && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Import Progress
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">{scrapingStatus.message}</Typography>
                  <Typography variant="body2">{scrapingStatus.progress}%</Typography>
                </Box>
                <LinearProgress variant="determinate" value={scrapingStatus.progress} />
              </Box>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Chip
                  icon={<ReceiptIcon />}
                  label={`${scrapingStatus.transactionsImported} imported`}
                  color="primary"
                  variant="outlined"
                />
                <Chip
                  icon={<CheckIcon />}
                  label={`${scrapingStatus.transactionsCategorized} categorized`}
                  color="success"
                  variant="outlined"
                />
              </Box>
            </CardContent>
          </Card>
        )}

        {loading && (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {scrapingStatus?.status === 'complete' 
                ? 'Analyzing transaction coverage...' 
                : 'Waiting for transaction import...'}
            </Typography>
          </Box>
        )}

        <Box sx={{ mt: 4, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            ⏳ What's happening now?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            1. Importing transactions from your new credit card account<br/>
            2. Categorizing and processing the new transaction data<br/>
            3. Analyzing which previous credit card payments are now covered<br/>
            4. Checking if additional accounts are needed
          </Typography>
        </Box>
      </Box>
    );
  }

  // Coverage analysis is complete - show results
  const isFullyCovered = coverageAnalysis.recommendation === 'complete';
  const needsMoreCards = coverageAnalysis.recommendation === 'connect_more';
  const isProcessing = coverageAnalysis.recommendation === 'processing';

  // If still processing, show a different view
  if (isProcessing) {
    return (
      <Box>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <ScheduleIcon color="primary" sx={{ fontSize: 64, mb: 2 }} />
          <Typography variant="h5" component="h2" gutterBottom>
            Transaction Processing in Progress
          </Typography>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            {coverageAnalysis.recommendationReason}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 3 }}>
          <Button 
            variant="contained" 
            size="large"
            onClick={handleRetryAnalysis}
          >
            Check Again
          </Button>
          <Button 
            variant="outlined" 
            size="large"
            onClick={handleCompleteOnboarding}
          >
            Complete Anyway
          </Button>
        </Box>

        <Box sx={{ mt: 4, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            ℹ️ Processing Status
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Your transactions are still being categorized by our AI system. 
            This usually takes a few minutes after import. You can wait for processing 
            to complete or continue with setup.
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        {isFullyCovered ? (
          <CheckIcon color="success" sx={{ fontSize: 64, mb: 2 }} />
        ) : (
          <WarningIcon color="warning" sx={{ fontSize: 64, mb: 2 }} />
        )}
        <Typography variant="h5" component="h2" gutterBottom>
          {isFullyCovered ? 'Credit Card Coverage Complete!' : 'Additional Cards Needed'}
        </Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          {coverageAnalysis.recommendationReason}
        </Typography>
      </Box>

      {/* Coverage Summary */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Coverage Analysis Results
          </Typography>
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            <Chip
              icon={<ReceiptIcon />}
              label={`${coverageAnalysis.totalCreditCardPayments} total payments`}
              color="default"
              variant="outlined"
            />
            <Chip
              icon={<CheckIcon />}
              label={`${coverageAnalysis.coveredPayments} covered (${coverageAnalysis.coveragePercentage}%)`}
              color="success"
              variant="filled"
            />
            {coverageAnalysis.uncoveredPayments > 0 && (
              <Chip
                icon={<WarningIcon />}
                label={`${coverageAnalysis.uncoveredPayments} uncovered`}
                color="warning"
                variant="filled"
              />
            )}
          </Box>

          {/* All Credit Card Transactions with Match Status */}
          <Divider sx={{ my: 2 }} />
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Credit Card Transactions (Last Month)
            </Typography>
            <List dense sx={{ maxHeight: 400, overflow: 'auto' }}>
              {/* Show matched payments first */}
              {coverageAnalysis.matchedPayments && coverageAnalysis.matchedPayments.map((match, index) => (
                <ListItem key={`matched-${index}`} sx={{ px: 0 }}>
                  <ListItemIcon>
                    <CheckIcon color="success" />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {match.payment.description}
                        </Typography>
                        <Chip
                          size="small"
                          label={match.matchedCreditCard.displayName}
                          color="success"
                          variant="filled"
                        />
                        <Chip
                          size="small" 
                          label={`${match.matchConfidence}% match`}
                          color="success"
                          variant="outlined"
                        />
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {new Date(match.payment.date).toLocaleDateString()} • ₪{match.payment.amount.toLocaleString()} • {match.matchedCreditCard.provider}
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
              
              {/* Show unmatched payments */}
              {coverageAnalysis.uncoveredSampleTransactions && coverageAnalysis.uncoveredSampleTransactions.map((transaction, index) => (
                <ListItem key={`unmatched-${index}`} sx={{ px: 0 }}>
                  <ListItemIcon>
                    <WarningIcon color="warning" />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {transaction.description}
                        </Typography>
                        <Chip
                          size="small"
                          label="No Match Found"
                          color="warning"
                          variant="outlined"
                        />
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {new Date(transaction.date).toLocaleDateString()} • ₪{transaction.amount.toLocaleString()} • Needs credit card connection
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 3 }}>
        {needsMoreCards ? (
          <>
            <Button 
              variant="contained" 
              size="large"
              onClick={handleConnectMoreCards}
              startIcon={<AddIcon />}
            >
              Connect More Credit Cards
            </Button>
            <Button 
              variant="outlined" 
              size="large"
              onClick={handleCompleteOnboarding}
            >
              Complete Anyway
            </Button>
          </>
        ) : (
          <Button 
            variant="contained" 
            size="large"
            onClick={handleCompleteOnboarding}
            startIcon={<CheckIcon />}
          >
            Complete Setup
          </Button>
        )}
      </Box>

      {/* Information Section */}
      <Box sx={{ mt: 4, p: 2, bgcolor: isFullyCovered ? 'success.light' : 'warning.light', borderRadius: 1 }}>
        <Typography variant="subtitle2" gutterBottom>
          {isFullyCovered ? '✅ Perfect Coverage!' : '⚠️ Partial Coverage'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {isFullyCovered 
            ? 'All your credit card transactions are now covered by connected accounts. Your financial overview is complete!'
            : 'Some credit card transactions are still not covered by your connected accounts. You can connect additional credit card providers or complete setup as-is.'}
        </Typography>
      </Box>
    </Box>
  );
};
