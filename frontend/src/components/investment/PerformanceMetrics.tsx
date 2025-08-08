import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';
import { PerformanceMetrics as PerformanceMetricsType } from '../../services/api/types/investment';
import { formatCurrency, formatPercentage } from '../../utils/formatters';

interface PerformanceMetricsProps {
  metrics: PerformanceMetricsType;
  loading?: boolean;
}

export const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({
  metrics,
  loading = false
}) => {
  const isPositiveGain = metrics.totalGain >= 0;
  const isPositiveDailyChange = metrics.averageDailyChange >= 0;

  const formatPeriod = (startDate: Date | null, endDate: Date | null) => {
    if (!startDate || !endDate) return 'N/A';
    
    const start = new Date(startDate).toLocaleDateString();
    const end = new Date(endDate).toLocaleDateString();
    return `${start} - ${end}`;
  };

  const getVolatilityLevel = (volatility: number) => {
    if (volatility < 1000) return { level: 'Low', color: 'success' as const };
    if (volatility < 5000) return { level: 'Medium', color: 'warning' as const };
    return { level: 'High', color: 'error' as const };
  };

  const volatilityInfo = getVolatilityLevel(metrics.volatility);

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <TimelineIcon color="primary" />
          <Typography variant="h6" component="h2">
            Performance Metrics
          </Typography>
          <Chip 
            label={`${metrics.daysTracked} days`} 
            size="small" 
            variant="outlined" 
          />
        </Box>

        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 3
        }}>
          {/* Total Gain/Loss */}
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
              {isPositiveGain ? (
                <TrendingUpIcon sx={{ color: 'success.main', mr: 0.5 }} />
              ) : (
                <TrendingDownIcon sx={{ color: 'error.main', mr: 0.5 }} />
              )}
              <Typography 
                variant="h5" 
                sx={{ 
                  fontWeight: 'bold',
                  color: isPositiveGain ? 'success.main' : 'error.main'
                }}
              >
                {formatCurrency(Math.abs(metrics.totalGain))}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Total {isPositiveGain ? 'Gain' : 'Loss'}
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                fontWeight: 600,
                color: isPositiveGain ? 'success.main' : 'error.main'
              }}
            >
              {formatPercentage(metrics.totalGainPercent)}
            </Typography>
          </Box>

          {/* Average Daily Change */}
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
              {isPositiveDailyChange ? (
                <TrendingUpIcon sx={{ color: 'success.main', mr: 0.5 }} />
              ) : (
                <TrendingDownIcon sx={{ color: 'error.main', mr: 0.5 }} />
              )}
              <Typography 
                variant="h5" 
                sx={{ 
                  fontWeight: 'bold',
                  color: isPositiveDailyChange ? 'success.main' : 'error.main'
                }}
              >
                {formatCurrency(Math.abs(metrics.averageDailyChange))}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Avg Daily Change
            </Typography>
          </Box>

          {/* Volatility */}
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>
              {formatCurrency(metrics.volatility)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Volatility
            </Typography>
            <Chip 
              label={volatilityInfo.level} 
              size="small" 
              color={volatilityInfo.color}
              variant="outlined"
            />
          </Box>

          {/* Portfolio Value Range */}
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
              {formatCurrency(metrics.startValue)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              Start Value
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              → {formatCurrency(metrics.endValue)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              End Value
            </Typography>
          </Box>
        </Box>

        {/* Period Information */}
        <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">
            Performance period: {formatPeriod(metrics.periodStart, metrics.periodEnd)}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};
