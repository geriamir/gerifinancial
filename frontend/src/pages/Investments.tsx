import React, { useEffect } from 'react';
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  Fade,
  Card,
  CardContent
} from '@mui/material';
import { useInvestment } from '../contexts/InvestmentContext';
import { InvestmentAccountList } from '../components/investment/InvestmentAccountList';
import { InvestmentTransactionList } from '../components/investments/InvestmentTransactionList';
import { PortfolioTimelineChart } from '../components/investment/PortfolioTimelineChart';

const Investments: React.FC = () => {
  const {
    investments,
    portfolioSummary,
    portfolioCashBalances,
    holdingsPriceData,
    loading,
    error,
    refreshInvestments,
    refreshPortfolioSummary,
    clearError
  } = useInvestment();

  useEffect(() => {
    const loadInvestmentData = async () => {
      try {
        await Promise.all([
          refreshInvestments(),
          refreshPortfolioSummary()
        ]);
      } catch (error) {
        console.error('Failed to load investment data:', error);
      }
    };

    loadInvestmentData();
  }, [refreshInvestments, refreshPortfolioSummary]);

  const handleRefresh = async () => {
    clearError();
    await Promise.all([
      refreshInvestments(),
      refreshPortfolioSummary()
    ]);
  };

  if (loading && !portfolioSummary) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress size={48} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Investment Portfolio
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Track your investment accounts, portfolio performance, and holdings
        </Typography>
      </Box>

      {/* Error Alert */}
      {error && (
        <Fade in={!!error}>
          <Alert 
            severity="error" 
            onClose={clearError}
            sx={{ mb: 3 }}
          >
            {error}
          </Alert>
        </Fade>
      )}

      {/* Main Content */}
      <Box sx={{ display: 'grid', gap: 3 }}>
        {/* Portfolio Timeline Chart */}
        {investments.length > 0 && (
          <Card>
            <CardContent>
              <PortfolioTimelineChart currency={portfolioSummary?.currency || 'USD'} />
            </CardContent>
          </Card>
        )}

        {/* Investment Accounts List */}
        <InvestmentAccountList
          investments={investments}
          portfolioCashBalances={portfolioCashBalances}
          holdingsPriceData={holdingsPriceData}
          loading={loading}
          onRefresh={handleRefresh}
        />

        {/* Investment Transactions */}
        <InvestmentTransactionList />
      </Box>

      {/* Empty State */}
      {!loading && investments.length === 0 && !error && (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            px: 2
          }}
        >
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Investment Accounts Found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Your investment accounts will appear here once you sync them from your connected bank accounts.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default Investments;
