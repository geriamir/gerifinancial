import React, { useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  AccountBalance as BankIcon,
  CreditCard as CreditCardIcon,
  Dashboard as DashboardIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import { OnboardingStepProps } from './OnboardingWizard';
import { useNavigate } from 'react-router-dom';

export const OnboardingComplete: React.FC<OnboardingStepProps> = ({
  onComplete,
  stepData
}) => {
  const navigate = useNavigate();

  const checkingAccount = stepData?.checkingaccount || stepData?.checkingAccount;
  const transactionData = stepData?.transactionimport || stepData?.transactionImport;
  const creditCardData = stepData?.creditcards || stepData?.creditCards;
  const analysisData = stepData?.creditcarddetection || stepData?.creditCardAnalysis;

  const getSetupSummary = () => {
    const summary = {
      hasCheckingAccount: !!checkingAccount,
      transactionsImported: transactionData?.transactionsImported || 0,
      hasCreditCards: creditCardData && creditCardData.length > 0,
      creditCardCount: creditCardData?.length || 0
    };
    return summary;
  };

  useEffect(() => {
    // Mark the completion step as complete when component mounts
    // This is crucial for updating the backend onboarding status
    if (onComplete) {
      onComplete('complete', {
        completionDate: new Date(),
        setupSummary: getSetupSummary()
      });
    }

    // Auto-redirect to dashboard after 10 seconds
    const timer = setTimeout(() => {
      navigate('/');
    }, 10000);

    return () => clearTimeout(timer);
  }, [navigate, onComplete, getSetupSummary]);

  const handleGoToDashboard = () => {
    navigate('/');
  };

  const summary = getSetupSummary();

  return (
    <Box>
      {/* Celebration Header */}
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <CheckIcon color="success" sx={{ fontSize: 80, mb: 2 }} />
        <Typography variant="h4" component="h2" gutterBottom>
          🎉 Setup Complete!
        </Typography>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Welcome to GeriFinancial
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Your financial overview is ready. Let's explore what we've set up for you.
        </Typography>
      </Box>

      {/* Setup Summary */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Your Setup Summary
          </Typography>
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
            {summary.hasCheckingAccount && (
              <Chip
                icon={<BankIcon />}
                label="Checking Account Connected"
                color="success"
                variant="filled"
              />
            )}
            {summary.transactionsImported > 0 && (
              <Chip
                icon={<TrendingUpIcon />}
                label={`${summary.transactionsImported.toLocaleString()} Transactions Imported`}
                color="primary"
                variant="filled"
              />
            )}
            {summary.hasCreditCards && (
              <Chip
                icon={<CreditCardIcon />}
                label={`${summary.creditCardCount} Credit Cards Connected`}
                color="success"
                variant="filled"
              />
            )}
          </Box>

          <List>
            {/* Checking Account */}
            <ListItem sx={{ px: 0 }}>
              <ListItemIcon>
                <CheckIcon color="success" />
              </ListItemIcon>
              <ListItemText
                primary="Main Checking Account"
                secondary={
                  checkingAccount 
                    ? `${checkingAccount.name} connected successfully`
                    : 'Connected and ready'
                }
              />
            </ListItem>

            {/* Transaction Import */}
            <ListItem sx={{ px: 0 }}>
              <ListItemIcon>
                <CheckIcon color="success" />
              </ListItemIcon>
              <ListItemText
                primary="Transaction History"
                secondary={
                  summary.transactionsImported > 0
                    ? `${summary.transactionsImported.toLocaleString()} transactions imported and categorized`
                    : 'Transaction import completed'
                }
              />
            </ListItem>

            {/* Credit Card Analysis */}
            <ListItem sx={{ px: 0 }}>
              <ListItemIcon>
                <CheckIcon color="success" />
              </ListItemIcon>
              <ListItemText
                primary="Credit Card Analysis"
                secondary={
                  analysisData?.recommendation === 'connect' && summary.hasCreditCards
                    ? `${summary.creditCardCount} credit cards connected and validated`
                    : analysisData?.recommendation === 'skip' 
                      ? 'Analysis complete - no credit cards needed'
                      : 'Credit card analysis completed'
                }
              />
            </ListItem>
          </List>
        </CardContent>
      </Card>

      {/* What's Next */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            What's Next?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Your GeriFinancial account is fully set up. Here's what you can do now:
          </Typography>
          
          <List>
            <ListItem sx={{ px: 0 }}>
              <ListItemIcon>
                <DashboardIcon color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Explore Your Dashboard"
                secondary="View your financial overview, spending patterns, and account balances"
              />
            </ListItem>

            <ListItem sx={{ px: 0 }}>
              <ListItemIcon>
                <TrendingUpIcon color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Review Transaction Categories"
                secondary="Check AI categorization results and adjust categories as needed"
              />
            </ListItem>

            <ListItem sx={{ px: 0 }}>
              <ListItemIcon>
                <CreditCardIcon color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Set Up Budgets"
                secondary="Create monthly budgets based on your spending patterns"
              />
            </ListItem>
          </List>
        </CardContent>
      </Card>

      {/* Action Button */}
      <Box sx={{ textAlign: 'center' }}>
        <Button 
          variant="contained" 
          size="large"
          onClick={handleGoToDashboard}
          startIcon={<DashboardIcon />}
          sx={{ mb: 2 }}
        >
          Go to Dashboard
        </Button>
        
        <Typography variant="body2" color="text.secondary">
          You'll be automatically redirected in a few seconds...
        </Typography>
      </Box>

      {/* Success Tips */}
      <Box sx={{ mt: 4, p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
        <Typography variant="subtitle2" gutterBottom>
          🎯 Pro Tips for Getting Started
        </Typography>
        <Typography variant="body2" color="text.secondary">
          • Review the AI-categorized transactions and adjust categories if needed<br/>
          • Set up monthly budgets for your main spending categories<br/>
          • Check back regularly for updated financial insights<br/>
          • Use the overview page to track your financial progress
        </Typography>
      </Box>

      {summary.hasCreditCards && (
        <Box sx={{ mt: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            💳 Credit Card Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Your credit cards are now connected and payment matching is active. We'll automatically 
            track your monthly payments and alert you to any discrepancies.
          </Typography>
        </Box>
      )}

      {/* Final Thank You */}
      <Box sx={{ mt: 4, textAlign: 'center', p: 3, bgcolor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="h6" gutterBottom>
          Thank you for choosing GeriFinancial! 🚀
        </Typography>
        <Typography variant="body2" color="text.secondary">
          We're excited to help you take control of your finances. 
          If you need any help, check out the help section in your dashboard.
        </Typography>
      </Box>
    </Box>
  );
};
