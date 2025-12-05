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
  ListItemIcon,
  Alert,
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
import { formatCurrencyDisplay } from '../../utils/formatters';

export interface CreditCardVerificationProps extends OnboardingStepProps {
  onAddMoreCards?: () => void;
  onCompleteOnboarding?: () => void;
  matching?: {
    completed: boolean;
    completedAt: string | null;
    totalCreditCardPayments: number;
    coveredPayments: number;
    uncoveredPayments: number;
    coveragePercentage: number;
    matchedPayments: Array<{
      payment: {
        id: string;
        date: string;
        description: string;
        amount: number;
      };
      matchedCreditCard: {
        id: string;
        displayName: string;
        cardNumber: string;
        lastFourDigits: string;
        provider: string;
      };
      matchedMonth: string;
      matchConfidence: number;
    }>;
    uncoveredSampleTransactions?: Array<{
      date: string;
      description: string;
      amount: number;
    }>;
    connectedCreditCards?: Array<{
      id: string;
      displayName: string;
      provider: string;
    }>;
  };
}

export const CreditCardVerification: React.FC<CreditCardVerificationProps> = ({
  matching,
  onComplete,
  onAddMoreCards,
  onCompleteOnboarding
}) => {
  // Debug logging
  console.log('[CreditCardVerification] Rendering with matching data:', matching);
  console.log('[CreditCardVerification] matching.matchedPayments type:', typeof matching?.matchedPayments);
  console.log('[CreditCardVerification] matching.matchedPayments isArray:', Array.isArray(matching?.matchedPayments));
  console.log('[CreditCardVerification] matching.matchedPayments length:', matching?.matchedPayments?.length);
  console.log('[CreditCardVerification] Full matching object:', JSON.stringify(matching, null, 2));
  
  // Use matching data from props (provided by wizard's polling)
  const isProcessing = !matching || !matching.completed;
  const isFullyCovered = matching && matching.coveragePercentage >= 80;

  const handleCompleteOnboarding = async () => {
    try {
      // Call the actual complete onboarding endpoint
      if (onCompleteOnboarding) {
        await onCompleteOnboarding();
      }
      // Then refetch to update the UI
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    }
  };

  const handleConnectMoreCards = () => {
    // Navigate back to credit card setup step
    if (onAddMoreCards) {
      onAddMoreCards();
    }
  };

  // Still processing
  if (isProcessing) {
    return (
      <Box>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <ScheduleIcon color="primary" sx={{ fontSize: 64, mb: 2 }} />
          <Typography variant="h5" component="h2" gutterBottom>
            Matching Credit Card Payments
          </Typography>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            We're analyzing your transactions to match credit card payments with your connected cards.
            This usually takes a few moments.
          </Typography>
        </Box>

        <Box sx={{ textAlign: 'center', py: 4 }}>
          <CircularProgress size={60} sx={{ mb: 2 }} />
          <Typography variant="body2" color="text.secondary">
            Analyzing transaction patterns...
          </Typography>
        </Box>

        <Box sx={{ mt: 4, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            ⏳ What's happening now?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • Analyzing credit card transactions from your imported data<br/>
            • Matching payments to connected credit card accounts<br/>
            • Calculating coverage percentage<br/>
            • Verifying transaction accuracy
          </Typography>
        </Box>
      </Box>
    );
  }

  // Matching complete - show results
  return (
    <Box>
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        {isFullyCovered ? (
          <CheckIcon color="success" sx={{ fontSize: 64, mb: 2 }} />
        ) : (
          <WarningIcon color="warning" sx={{ fontSize: 64, mb: 2 }} />
        )}
        <Typography variant="h5" component="h2" gutterBottom>
          {isFullyCovered ? 'Credit Card Verification Complete!' : 'Partial Coverage Detected'}
        </Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          {isFullyCovered 
            ? 'Your credit card payments have been successfully matched with your connected accounts.'
            : 'Some credit card payments could not be matched with your connected accounts.'
          }
        </Typography>
      </Box>

      {/* Matching Summary */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Matching Results
          </Typography>
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            <Chip
              icon={<ReceiptIcon />}
              label={`${matching.totalCreditCardPayments} total payments`}
              color="default"
              variant="outlined"
            />
            <Chip
              icon={<CheckIcon />}
              label={`${matching.coveredPayments} matched (${matching.coveragePercentage}%)`}
              color="success"
              variant="filled"
            />
            {matching.uncoveredPayments > 0 && (
              <Chip
                icon={<WarningIcon />}
                label={`${matching.uncoveredPayments} unmatched`}
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
              {matching.matchedPayments && Array.isArray(matching.matchedPayments) && matching.matchedPayments.map((match, index) => (
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
                        {new Date(match.payment.date).toLocaleDateString()} • {formatCurrencyDisplay(match.payment.amount)} • {match.matchedCreditCard.provider}
                      </Typography>
                    }
                  />
                </ListItem>
              ))}

              {/* Show unmatched payments */}
              {matching.uncoveredSampleTransactions && Array.isArray(matching.uncoveredSampleTransactions) && matching.uncoveredSampleTransactions.map((transaction, index) => (
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
                        {new Date(transaction.date).toLocaleDateString()} • {formatCurrencyDisplay(transaction.amount)} • Needs credit card connection
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        </CardContent>
      </Card>

      {/* Success or Partial Coverage Alert */}
      {isFullyCovered ? (
        <Alert severity="success" sx={{ mb: 3 }}>
          <Typography variant="subtitle2">Excellent Coverage!</Typography>
          <Typography variant="body2">
            {matching.coveragePercentage}% of your credit card payments have been matched. 
            Your financial overview is complete and ready to use.
          </Typography>
        </Alert>
      ) : (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="subtitle2">Partial Coverage</Typography>
          <Typography variant="body2">
            {matching.coveragePercentage}% of credit card payments matched. Some payments couldn't be linked 
            to your connected cards. You can add more cards later from your dashboard if needed.
          </Typography>
        </Alert>
      )}

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 3 }}>
        {!isFullyCovered ? (
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
          {isFullyCovered ? '✅ Perfect Coverage!' : '⚠ Partial Coverage'}
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
