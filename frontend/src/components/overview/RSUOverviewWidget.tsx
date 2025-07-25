import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Chip,
  LinearProgress,
  Skeleton
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Schedule as ScheduleIcon,
  ShowChart as ShowChartIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useRSU } from '../../contexts/RSUContext';

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
    upcomingVesting,
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
  const nextVestingEvents = upcomingVesting?.slice(0, maxUpcomingVesting) || [];

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

        {/* Total Portfolio Value */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Total Portfolio Value
          </Typography>
          <Typography variant="h4" color="primary.main" gutterBottom>
            ${portfolioSummary.grants.totalCurrentValue.toLocaleString()}
          </Typography>
        </Box>

        {/* Gain/Loss */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Total Gain/Loss
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {isPositiveGainLoss ? (
              <TrendingUpIcon fontSize="small" color="success" />
            ) : (
              <TrendingDownIcon fontSize="small" color="error" />
            )}
            <Typography 
              variant="h5" 
              color={isPositiveGainLoss ? 'success.main' : 'error.main'}
            >
              {isPositiveGainLoss ? '+' : ''}${portfolioSummary.grants.totalGainLoss.toLocaleString()}
            </Typography>
            <Typography 
              variant="body2" 
              color={isPositiveGainLoss ? 'success.main' : 'error.main'}
              sx={{ ml: 1 }}
            >
              ({isPositiveGainLoss ? '+' : ''}{portfolioSummary.grants.gainLossPercentage.toFixed(1)}%)
            </Typography>
          </Box>
        </Box>

        {/* Vesting Progress */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Overall Vesting Progress
            </Typography>
            <Typography variant="body2" color="info.main" fontWeight="medium">
              {Math.round(portfolioSummary.vesting.overallProgress)}%
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={portfolioSummary.vesting.overallProgress} 
            sx={{ height: 6, borderRadius: 3 }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Vested: {portfolioSummary.vesting.totalVestedShares.toLocaleString()} shares
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Unvested: {portfolioSummary.vesting.totalUnvestedShares.toLocaleString()} shares
            </Typography>
          </Box>
        </Box>

        {/* Upcoming Vesting Events */}
        {nextVestingEvents.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Upcoming Vesting
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {nextVestingEvents.map((event, index) => {
                const vestDate = new Date(event.vestDate);
                const daysFromNow = Math.ceil((vestDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                const isUrgent = daysFromNow <= 7;
                
                return (
                  <Box key={index} sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    p: 1,
                    bgcolor: isUrgent ? 'warning.light' : 'action.hover',
                    borderRadius: 1,
                    fontSize: '0.875rem'
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ScheduleIcon fontSize="small" color={isUrgent ? 'warning' : 'primary'} />
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {event.stockSymbol}: {event.shares.toLocaleString()} shares
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {vestDate.toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </Typography>
                      </Box>
                    </Box>
                    <Typography 
                      variant="caption" 
                      color={isUrgent ? 'warning.main' : 'text.secondary'}
                      fontWeight="medium"
                    >
                      {daysFromNow <= 0 ? 'Today' : 
                       daysFromNow === 1 ? 'Tomorrow' : 
                       `${daysFromNow} days`}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

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
