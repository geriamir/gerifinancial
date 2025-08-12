import React, { useState, useEffect, useRef } from 'react';
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
  ListItemIcon
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Info as InfoIcon,
  CreditCard as CreditCardIcon,
  Receipt as ReceiptIcon
} from '@mui/icons-material';
import { OnboardingStepProps } from './OnboardingWizard';
import { onboardingApi } from '../../services/api/onboarding';

interface CreditCardAnalysis {
  hasCreditCardActivity: boolean;
  transactionCount: number;
  recommendation: 'connect' | 'optional' | 'skip';
  recommendationReason: string;
  recentTransactions: Array<{
    date: string;
    description: string;
    amount: number;
  }>;
  analyzedAt: string;
}

export const CreditCardDetection: React.FC<OnboardingStepProps> = ({
  onComplete,
  onSkip
}) => {
  const [analysis, setAnalysis] = useState<CreditCardAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Prevent duplicate API calls
  const isAnalyzing = useRef(false);

  useEffect(() => {
    if (!isAnalyzing.current) {
      analyzeCreditCardUsage();
    }
  }, []);

  const analyzeCreditCardUsage = async () => {
    // Prevent duplicate calls
    if (isAnalyzing.current) {
      return;
    }
    
    try {
      isAnalyzing.current = true;
      setLoading(true);
      setError(null);
      
      const analysisResult = await onboardingApi.analyzeCreditCards(1); // 1 month back
      setAnalysis(analysisResult);
    } catch (err) {
      console.error('Credit card analysis failed:', err);
      setError('Failed to analyze credit card usage');
      
      // Fallback to mock data for development
      if (process.env.NODE_ENV === 'development') {
        const mockAnalysis: CreditCardAnalysis = {
          hasCreditCardActivity: Math.random() > 0.5,
          transactionCount: Math.floor(Math.random() * 50) + 10,
          recommendation: Math.random() > 0.5 ? 'connect' : 'skip',
          recommendationReason: 'Regular credit card activity detected',
          recentTransactions: [
            { date: '2024-08-15', description: 'Credit Card Payment', amount: 1200 },
            { date: '2024-07-15', description: 'Visa Cal Payment', amount: 1850 }
          ],
          analyzedAt: new Date().toISOString()
        };
        setAnalysis(mockAnalysis);
      }
    } finally {
      setLoading(false);
      isAnalyzing.current = false;
    }
  };

  const handleConnectCreditCards = () => {
    onComplete('credit-card-setup', {
      hasCreditCardActivity: analysis?.hasCreditCardActivity,
      transactionCount: analysis?.transactionCount,
      recommendation: analysis?.recommendation,
      analysisDate: new Date()
    });
  };

  const handleSkipCreditCards = () => {
    if (onSkip) {
      onSkip();
    } else {
      onComplete('complete', {
        hasCreditCardActivity: false,
        transactionCount: 0,
        recommendation: 'skip',
        analysisDate: new Date()
      });
    }
  };

  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <CircularProgress size={60} sx={{ mb: 3 }} />
        <Typography variant="h6" gutterBottom>
          🤖 Analyzing Your Transaction History
        </Typography>
        <Typography variant="body1" color="text.secondary">
          We're looking through your transactions to detect credit card usage patterns...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="subtitle2">Analysis Failed</Typography>
          <Typography variant="body2">{error}</Typography>
        </Alert>
        
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
          <Button onClick={analyzeCreditCardUsage} variant="outlined">
            Try Again
          </Button>
          <Button onClick={handleSkipCreditCards} variant="text">
            Skip Credit Card Setup
          </Button>
        </Box>
      </Box>
    );
  }

  if (!analysis) {
    return null;
  }

  // Render based on recommendation
  if (analysis.recommendation === 'connect') {
    return (
      <Box>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <CheckIcon color="success" sx={{ fontSize: 64, mb: 2 }} />
          <Typography variant="h5" component="h2" gutterBottom>
            Credit Cards Detected!
          </Typography>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            We found significant credit card activity in your transaction history. 
            Adding your credit card accounts will give you a complete financial picture.
          </Typography>
        </Box>

        {/* Recent Credit Card Transactions */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Recent Credit Card Transactions Found
            </Typography>
            
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              <Chip
                icon={<ReceiptIcon />}
                label={`${analysis.transactionCount} credit card transactions`}
                color="primary"
                variant="filled"
              />
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {analysis.recommendationReason}
            </Typography>

            {/* All Credit Card Transactions from Last Month */}
            {analysis.recentTransactions && analysis.recentTransactions.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  All Credit Card Transactions from Last Month
                </Typography>
                <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                  {analysis.recentTransactions.map((transaction, index) => (
                    <ListItem key={index} sx={{ px: 0 }}>
                      <ListItemIcon>
                        <CreditCardIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={transaction.description}
                        secondary={`${new Date(transaction.date).toLocaleDateString()} • ₪${transaction.amount.toLocaleString()}`}
                      />
                    </ListItem>
                  ))}
                </List>
                {analysis.recentTransactions.length > 10 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Showing all {analysis.recentTransactions.length} transactions from the last month
                  </Typography>
                )}
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 3 }}>
          <Button 
            variant="contained" 
            size="large"
            onClick={handleConnectCreditCards}
            startIcon={<CreditCardIcon />}
          >
            Connect Credit Cards
          </Button>
          <Button 
            variant="outlined" 
            size="large"
            onClick={handleSkipCreditCards}
          >
            Skip for Now
          </Button>
        </Box>

        {/* Benefits Info */}
        <Box sx={{ mt: 4, p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            💡 Why connect credit cards?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • Get complete spending analysis across all accounts<br/>
            • Track monthly payment accuracy<br/>
            • Better budgeting with full transaction visibility<br/>
            • Automatic categorization of credit card purchases
          </Typography>
        </Box>
      </Box>
    );
  }

  // No significant credit card activity
  return (
    <Box>
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <InfoIcon color="info" sx={{ fontSize: 64, mb: 2 }} />
        <Typography variant="h5" component="h2" gutterBottom>
          No Credit Card Activity Detected
        </Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          We didn't find significant credit card transactions in your recent banking history. 
          You can skip credit card setup for now and add them later if needed.
        </Typography>
      </Box>

      {/* Analysis Summary */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Analysis Summary
          </Typography>
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            <Chip
              icon={<ReceiptIcon />}
              label={`${analysis.transactionCount} transactions found`}
              color="default"
              variant="outlined"
            />
          </Box>

          <Typography variant="body2" color="text.secondary">
            {analysis.recommendationReason || 
             'Based on your transaction history, credit card setup appears optional.'}
          </Typography>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 3 }}>
        <Button 
          variant="outlined" 
          size="large"
          onClick={handleConnectCreditCards}
          startIcon={<CreditCardIcon />}
        >
          Connect Anyway
        </Button>
        <Button 
          variant="contained" 
          size="large"
          onClick={handleSkipCreditCards}
        >
          Continue Without Credit Cards
        </Button>
      </Box>

      {/* Optional Info */}
      <Box sx={{ mt: 4, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
        <Typography variant="subtitle2" gutterBottom>
          ℹ️ You can always add credit cards later
        </Typography>
        <Typography variant="body2" color="text.secondary">
          If you get credit cards in the future or want to connect existing ones, 
          you can easily add them from the Bank Accounts section in your dashboard.
        </Typography>
      </Box>
    </Box>
  );
};
