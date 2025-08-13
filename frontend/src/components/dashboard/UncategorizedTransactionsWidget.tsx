import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Alert,
  CircularProgress,
  Chip
} from '@mui/material';
import {
  Category as CategoryIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  ArrowForward as ArrowIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { transactionsApi } from '../../services/api/transactions';
import type { UncategorizedStats } from '../../services/api/types/transactions';

interface UncategorizedTransactionsWidgetProps {
  onStatsLoad?: (stats: UncategorizedStats) => void;
}

const UncategorizedTransactionsWidget: React.FC<UncategorizedTransactionsWidgetProps> = ({
  onStatsLoad
}) => {
  const [stats, setStats] = useState<UncategorizedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await transactionsApi.getUncategorizedStats();
        setStats(data);
        onStatsLoad?.(data);
      } catch (err) {
        setError('Failed to load uncategorized transaction stats');
        console.error('Error fetching uncategorized stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [onStatsLoad]);

  const handleViewUncategorized = () => {
    // Navigate to transactions page with filter for uncategorized
    // Using both parameters for maximum compatibility
    navigate('/transactions?category=uncategorized&filter=uncategorized');
  };

  if (loading) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 150 }}>
          <CircularProgress size={24} />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  const hasUncategorized = stats.total > 0;

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <CategoryIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6" component="div">
            Transaction Categorization
          </Typography>
        </Box>

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {hasUncategorized ? (
            <>
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                <Typography variant="h2" component="div" color="warning.main" sx={{ fontWeight: 'bold' }}>
                  {stats.total}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {stats.total === 1 ? 'transaction needs' : 'transactions need'} categorization
                </Typography>
              </Box>
              
              <Chip
                icon={<WarningIcon />}
                label="Action Required"
                color="warning"
                sx={{ alignSelf: 'center', mb: 2 }}
              />
            </>
          ) : (
            <>
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                <CheckIcon sx={{ fontSize: 60, color: 'success.main', mb: 1 }} />
                <Typography variant="h6" color="success.main">
                  All transactions categorized!
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Great job keeping your finances organized
                </Typography>
              </Box>
            </>
          )}
        </Box>

        {hasUncategorized && (
          <Button
            variant="contained"
            endIcon={<ArrowIcon />}
            onClick={handleViewUncategorized}
            fullWidth
            sx={{ mt: 'auto' }}
          >
            Categorize Transactions
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default UncategorizedTransactionsWidget;
