import React from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
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

export interface CreditCardDetectionProps extends OnboardingStepProps {
  detection?: {
    analyzed: boolean;
    analyzedAt: string | null;
    transactionCount: number;
    recommendation: 'connect' | 'optional' | 'skip' | null;
    sampleTransactions: Array<{
      date: string;
      description: string;
      amount: number;
    }>;
  };
  onProceed?: () => Promise<void>;
  onSkip?: () => Promise<void>;
}

export const CreditCardDetection: React.FC<CreditCardDetectionProps> = ({
  detection,
  onComplete,
  onProceed,
  onSkip
}) => {
  // Use detection data from props (provided by wizard's onboarding status)
  const loading = !detection || !detection.analyzed;

  const handleConnectCreditCards = async () => {
    if (onProceed) {
      await onProceed();
    } else if (onComplete) {
      onComplete();
    }
  };

  const handleSkipCreditCards = async () => {
    if (onSkip) {
      await onSkip();
    } else if (onComplete) {
      onComplete();
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

  if (!detection) {
    return null;
  }

  const recommendation = detection.recommendation || 'skip';
  const transactionCount = detection.transactionCount || 0;
  const sampleTransactions = detection.sampleTransactions || [];

  // Render based on recommendation
  if (recommendation === 'connect') {
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
                label={`${transactionCount} credit card transaction${transactionCount !== 1 ? 's' : ''}`}
                color="primary"
                variant="filled"
              />
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              We detected regular credit card payments in your account.
            </Typography>

            {/* Sample Credit Card Transactions */}
            {sampleTransactions.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Sample Credit Card Transactions
                </Typography>
                <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                  {sampleTransactions.map((transaction, index) => (
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
                {sampleTransactions.length > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Showing {sampleTransactions.length} sample transaction{sampleTransactions.length !== 1 ? 's' : ''}
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

  // No significant credit card activity (optional or skip)
  return (
    <Box>
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <InfoIcon color="info" sx={{ fontSize: 64, mb: 2 }} />
        <Typography variant="h5" component="h2" gutterBottom>
          {transactionCount > 0 ? 'Limited Credit Card Activity' : 'No Credit Card Activity Detected'}
        </Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          {transactionCount > 0 
            ? 'We found some credit card transactions, but they appear minimal. You can skip credit card setup for now and add them later if needed.'
            : 'We did not find significant credit card transactions in your recent banking history. You can skip credit card setup for now and add them later if needed.'
          }
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
              label={`${transactionCount} transaction${transactionCount !== 1 ? 's' : ''} found`}
              color="default"
              variant="outlined"
            />
          </Box>

          <Typography variant="body2" color="text.secondary">
            Based on your transaction history, credit card setup appears optional.
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
