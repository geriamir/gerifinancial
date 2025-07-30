import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Chip,
  Skeleton
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  ShowChart as ShowChartIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useRSU } from '../../contexts/RSUContext';
import RSUVestingChart from '../rsu/RSUVestingChart';

interface RSUOverviewWidgetProps {
  maxUpcomingVesting?: number;
}

const RSUOverviewWidget: React.FC<RSUOverviewWidgetProps> = ({ 
  maxUpcomingVesting = 3 
}) => {
  const navigate = useNavigate();
  
  const {
    portfolioSummary,
    grants,
    loading,
    portfolioLoading
  } = useRSU();

  const handleViewPortfolio = () => {
    navigate('/rsus');
  };

  const handleAddGrant = () => {
    navigate('/rsus');
    // The RSU page will need to open the add grant wizard
  };

  // Show loading skeleton
  if (loading || portfolioLoading) {
    return (
      <Card sx={{ height: '100%', minHeight: 300 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Skeleton variant="text" width="40%" height={28} />
            <Skeleton variant="rectangular" width={80} height={24} />
          </Box>
          
          <Box sx={{ mb: 3 }}>
            <Skeleton variant="text" width="30%" height={20} />
            <Skeleton variant="text" width="60%" height={32} />
          </Box>
          
          <Box sx={{ mb: 3 }}>
            <Skeleton variant="text" width="25%" height={20} />
            <Skeleton variant="text" width="50%" height={32} />
          </Box>
          
          <Box sx={{ mb: 2 }}>
            <Skeleton variant="text" width="35%" height={20} />
            <Skeleton variant="rectangular" width="100%" height={8} />
          </Box>
          
          <Skeleton variant="rectangular" width="100%" height={36} />
        </CardContent>
      </Card>
    );
  }

  // No grants state
  if (!portfolioSummary || grants.length === 0) {
    return (
      <Card sx={{ height: '100%', minHeight: 300 }}>
        <CardContent sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          height: '100%',
          justifyContent: 'center',
          textAlign: 'center'
        }}>
          <Box sx={{ mb: 2 }}>
            <ShowChartIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography variant="h6" gutterBottom>
              RSU Portfolio
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Start tracking your Restricted Stock Units to monitor vesting schedules and portfolio performance.
            </Typography>
          </Box>
          
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddGrant}
            sx={{ alignSelf: 'center' }}
          >
            Add First Grant
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isPositiveGainLoss = portfolioSummary.grants.totalGainLoss >= 0;

  return (
    <Card sx={{ height: '100%', minHeight: 300 }}>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" component="h3">
            RSU Portfolio
          </Typography>
          <Chip
            size="small"
            label={`${grants.length} Grant${grants.length !== 1 ? 's' : ''}`}
            color="primary"
            variant="outlined"
          />
        </Box>

        {/* Compact Portfolio Summary */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          mb: 3,
          p: 2,
          bgcolor: 'action.hover',
          borderRadius: 1
        }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Portfolio Value
            </Typography>
            <Typography variant="h6" color="primary.main">
              ${(portfolioSummary.grants.totalCurrentValue / 1000).toFixed(0)}k
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" color="text.secondary">
              Gain/Loss
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {isPositiveGainLoss ? (
                <TrendingUpIcon fontSize="small" color="success" />
              ) : (
                <TrendingDownIcon fontSize="small" color="error" />
              )}
              <Typography 
                variant="body2" 
                color={isPositiveGainLoss ? 'success.main' : 'error.main'}
                fontWeight="medium"
              >
                {isPositiveGainLoss ? '+' : ''}{portfolioSummary.grants.gainLossPercentage.toFixed(1)}%
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Compact Vesting Chart */}
        <Box sx={{ mb: 3 }}>
          <RSUVestingChart height={200} />
        </Box>

        {/* Action Button */}
        <Button
          variant="outlined"
          fullWidth
          onClick={handleViewPortfolio}
          sx={{ mt: 'auto' }}
        >
          View Full Portfolio
        </Button>
      </CardContent>
    </Card>
  );
};

export default RSUOverviewWidget;
