import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  Chip,
  Skeleton
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AccountBalance as AccountBalanceIcon
} from '@mui/icons-material';
import { PortfolioSummary } from '../../services/api/rsus';

interface RSUPortfolioCardProps {
  portfolioSummary: PortfolioSummary | null;
  loading?: boolean;
}

const RSUPortfolioCard: React.FC<RSUPortfolioCardProps> = ({
  portfolioSummary,
  loading = false
}) => {

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Skeleton variant="text" width="40%" height={32} />
          <Box sx={{ mt: 3, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 3 }}>
            {[1, 2, 3, 4].map((item) => (
              <Box key={item}>
                <Skeleton variant="text" width="60%" height={24} />
                <Skeleton variant="text" width="80%" height={36} />
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (!portfolioSummary) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <AccountBalanceIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No RSU Portfolio Data
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Add your first RSU grant to see portfolio analytics
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  const {
    summary: {
      totalPortfolioValue,
      portfolioGainLoss,
      overallProgress
    },
    grants: {
      totalGrants
    },
    vesting: {
      totalVestedShares,
      totalUnvestedShares,
      vestedPostTax
    },
    sales: {
      recentSalesCount,
      totalNetProceeds
    }
  } = portfolioSummary;

  const gainLossPercentage = portfolioSummary.grants.totalOriginalValue > 0 
    ? (portfolioGainLoss / portfolioSummary.grants.totalOriginalValue) * 100 
    : 0;

  const isPositiveGainLoss = portfolioGainLoss >= 0;
  const vestingProgressPercent = Math.round(overallProgress);

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" component="h2">
            RSU Portfolio Overview
          </Typography>
          <Chip
            icon={isPositiveGainLoss ? <TrendingUpIcon /> : <TrendingDownIcon />}
            label={`${isPositiveGainLoss ? '+' : ''}${gainLossPercentage.toFixed(1)}%`}
            color={isPositiveGainLoss ? 'success' : 'error'}
            variant="outlined"
          />
        </Box>

        {/* Main Metrics Grid */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' },
          gap: 3,
          mb: 3
        }}>
          {/* Total Portfolio Value */}
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Total Portfolio Value
            </Typography>
            <Typography variant="h4" color="primary" fontWeight="bold">
              ${totalPortfolioValue.toLocaleString()}
            </Typography>
          </Box>

          {/* Gain/Loss */}
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Total Gain/Loss
            </Typography>
            <Typography 
              variant="h4" 
              color={isPositiveGainLoss ? 'success.main' : 'error.main'}
              fontWeight="bold"
            >
              {isPositiveGainLoss ? '+' : ''}${portfolioGainLoss.toLocaleString()}
            </Typography>
          </Box>

          {/* Vesting Progress */}
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Vesting Progress
            </Typography>
            <Typography variant="h4" color="info.main" fontWeight="bold">
              {vestingProgressPercent}%
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={vestingProgressPercent} 
              sx={{ mt: 1, height: 6, borderRadius: 3 }}
            />
          </Box>

          {/* Active Grants */}
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Active Grants
            </Typography>
            <Typography variant="h4" color="warning.main" fontWeight="bold">
              {totalGrants}
            </Typography>
          </Box>
        </Box>

        {/* Secondary Metrics */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
          gap: 2,
          pt: 2,
          borderTop: 1,
          borderColor: 'divider'
        }}>
          {/* Vested Shares */}
          <Box>
            <Typography variant="body2" color="text.secondary">
              Vested Shares
            </Typography>
            <Typography variant="h6" color="success.main">
              {totalVestedShares.toLocaleString()}
            </Typography>
          </Box>

          {/* Unvested Shares */}
          <Box>
            <Typography variant="body2" color="text.secondary">
              Unvested Shares
            </Typography>
            <Typography variant="h6" color="warning.main">
              {totalUnvestedShares.toLocaleString()}
            </Typography>
          </Box>

          {/* Recent Sales */}
          <Box>
            <Typography variant="body2" color="text.secondary">
              Recent Sales (90d)
            </Typography>
            <Typography variant="h6">
              {recentSalesCount} sales
            </Typography>
          </Box>

          {/* Net Proceeds */}
          <Box>
            <Typography variant="body2" color="text.secondary">
              Net Proceeds (90d)
            </Typography>
            <Typography variant="h6" color="primary">
              ${totalNetProceeds.toLocaleString()}
            </Typography>
          </Box>
        </Box>

        {/* Vested Post-Tax Values Section */}
        {vestedPostTax && vestedPostTax.totalVestedShares > 0 && (
          <Box sx={{
            mt: 3,
            p: 3,
            bgcolor: 'success.light',
            borderRadius: 2,
            border: 1,
            borderColor: 'success.main'
          }}>
            <Typography variant="h6" color="success.dark" gutterBottom sx={{ fontWeight: 'bold' }}>
              Vested Shares Post-Tax Analysis (2+ Years Old Only)
            </Typography>
            
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
              gap: 2
            }}>
              {/* Vested Current Value */}
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Vested Market Value
                </Typography>
                <Typography variant="h6" color="primary" fontWeight="bold">
                  ${vestedPostTax.totalVestedCurrentValue.toLocaleString()}
                </Typography>
              </Box>

              {/* Estimated Tax Liability */}
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Est. Tax Liability
                </Typography>
                <Typography variant="h6" color="error.main" fontWeight="bold">
                  ${vestedPostTax.estimatedTaxLiability.toLocaleString()}
                </Typography>
              </Box>

              {/* Post-Tax Liquid Value */}
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Post-Tax Liquid Value
                </Typography>
                <Typography variant="h6" color="success.dark" fontWeight="bold">
                  ${vestedPostTax.totalVestedPostTaxValue.toLocaleString()}
                </Typography>
              </Box>

              {/* Effective Tax Rate */}
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Effective Tax Rate
                </Typography>
                <Typography variant="h6" color="warning.dark" fontWeight="bold">
                  {vestedPostTax.totalVestedCurrentValue > 0 
                    ? Math.round((vestedPostTax.estimatedTaxLiability / vestedPostTax.totalVestedCurrentValue) * 100)
                    : 0}%
                </Typography>
              </Box>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 2, fontStyle: 'italic' }}>
              * Estimates based on Israeli tax rates: 65% wage income tax + capital gains tax (25% for grants 2+ years old, 65% for newer grants)
            </Typography>
          </Box>
        )}

      </CardContent>
    </Card>
  );
};

export default RSUPortfolioCard;
