import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  IconButton,
  Tooltip,
  Chip,
  LinearProgress
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AccountBalance as AccountIcon
} from '@mui/icons-material';
import { PortfolioSummary } from '../../services/api/types/investment';
import { formatCurrency, formatNumber } from '../../utils/formatters';

interface InvestmentPortfolioCardProps {
  portfolioSummary: PortfolioSummary | null;
  loading: boolean;
  onRefresh: () => void;
}

export const InvestmentPortfolioCard: React.FC<InvestmentPortfolioCardProps> = ({
  portfolioSummary,
  loading,
  onRefresh
}) => {
  const formatLastUpdated = (date: Date | null) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - new Date(date).getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    
    return new Date(date).toLocaleDateString();
  };

  const getPortfolioComposition = () => {
    if (!portfolioSummary) return [];
    
    const { totalMarketValue, totalCashBalance, totalBalance } = portfolioSummary;
    const total = totalMarketValue + totalCashBalance + totalBalance;
    
    if (total === 0) return [];
    
    return [
      {
        label: 'Investments',
        value: totalMarketValue,
        percentage: (totalMarketValue / total) * 100,
        color: '#2196f3'
      },
      {
        label: 'Cash',
        value: totalCashBalance,
        percentage: (totalCashBalance / total) * 100,
        color: '#4caf50'
      },
      {
        label: 'Other',
        value: totalBalance,
        percentage: (totalBalance / total) * 100,
        color: '#ff9800'
      }
    ].filter(item => item.value > 0);
  };

  const composition = getPortfolioComposition();

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccountIcon color="primary" />
            <Typography variant="h6" component="h2">
              Portfolio Overview
            </Typography>
          </Box>
          <Tooltip title="Refresh portfolio data">
            <IconButton 
              onClick={onRefresh} 
              disabled={loading}
              size="small"
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Loading State */}
        {loading && <LinearProgress sx={{ mb: 2 }} />}

        {/* Portfolio Values */}
        {portfolioSummary ? (
          <>
            {/* Total Value */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h3" component="div" sx={{ fontWeight: 'bold', mb: 1 }}>
                {formatCurrency(portfolioSummary.totalValue)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Portfolio Value
              </Typography>
            </Box>

            {/* Portfolio Breakdown */}
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
              gap: 3,
              mb: 3
            }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {formatCurrency(portfolioSummary.totalMarketValue)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Market Investments
                </Typography>
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {formatCurrency(portfolioSummary.totalCashBalance)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Cash Balance
                </Typography>
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {portfolioSummary.accountCount}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Investment Accounts
                </Typography>
              </Box>
            </Box>

            {/* Portfolio Composition Bars */}
            {composition.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                  Portfolio Allocation
                </Typography>
                {composition.map((item, index) => (
                  <Box key={item.label} sx={{ mb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">
                        {item.label}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {item.percentage.toFixed(1)}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={item.percentage}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: 'rgba(0,0,0,0.1)',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: item.color,
                          borderRadius: 3
                        }
                      }}
                    />
                  </Box>
                ))}
              </Box>
            )}

            {/* Top Holdings */}
            {portfolioSummary.topHoldings && portfolioSummary.topHoldings.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                  Top Holdings
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {portfolioSummary.topHoldings.slice(0, 5).map((holding) => (
                    <Chip
                      key={holding.symbol}
                      label={`${holding.symbol} (${formatCurrency(holding.totalMarketValue)})`}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                  {portfolioSummary.topHoldings.length > 5 && (
                    <Chip
                      label={`+${portfolioSummary.topHoldings.length - 5} more`}
                      size="small"
                      variant="outlined"
                      color="secondary"
                    />
                  )}
                </Box>
              </Box>
            )}

            {/* Last Updated */}
            <Box sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">
                Last updated: {formatLastUpdated(portfolioSummary.lastUpdated)}
              </Typography>
            </Box>
          </>
        ) : (
          !loading && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                No portfolio data available
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Sync your bank accounts to view your investment portfolio
              </Typography>
            </Box>
          )
        )}
      </CardContent>
    </Card>
  );
};
