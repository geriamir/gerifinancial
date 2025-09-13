import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Paper,
  Chip,
  Grid,
  IconButton,
  Collapse,
  Alert,
  Button
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CreditCard as CreditCardIcon,
  TrendingUp as TrendingUpIcon,
  Receipt as ReceiptIcon,
  Analytics as AnalyticsIcon
} from '@mui/icons-material';
import { creditCardsApi } from '../../services/api/creditCards';
import { 
  CreditCardWithStats, 
  CreditCardBasicStats, 
  CreditCardTrend,
  MonthlyTrendData 
} from '../../services/api/types/creditCard';
import { CreditCardChart } from './CreditCardChart';
import { CreditCardMonthlyDetail } from './CreditCardMonthlyDetail';
import { formatCurrency } from '../../utils/formatters';

interface CreditCardItemProps {
  card: CreditCardWithStats;
}

const CreditCardItem: React.FC<CreditCardItemProps> = ({ card }) => {
  const [expanded, setExpanded] = useState(false);
  const [stats, setStats] = useState<CreditCardBasicStats | null>(null);
  const [trend, setTrend] = useState<CreditCardTrend | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showMonthlyDetail, setShowMonthlyDetail] = useState(false);

  const handleExpand = async () => {
    if (!expanded && !stats) {
      setLoading(true);
      setError('');
      try {
        const [statsData, trendData] = await Promise.all([
          creditCardsApi.getBasicStats(card._id),
          creditCardsApi.getTrend(card._id)
        ]);
        setStats(statsData);
        setTrend(trendData);
      } catch (err) {
        setError('Failed to load credit card details');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    setExpanded(!expanded);
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CreditCardIcon color="primary" />
            <Box>
              <Typography variant="h6">{card.name}</Typography>
              <Typography variant="body2" color="textSecondary">
                {card.identifier}
              </Typography>
            </Box>
          </Box>
          
          <Stack direction="row" spacing={2} alignItems="center">
            <Box textAlign="right">
              <Typography variant="body2" color="textSecondary">
                Last 6 Months
              </Typography>
              <Typography variant="h6" color="primary">
                {formatCurrency(card.totalSpentLast6Months)}
              </Typography>
            </Box>
            
            <Chip 
              icon={<ReceiptIcon />}
              label={`${card.recentTransactionCount} transactions`}
              size="small"
              variant="outlined"
            />
            
            <IconButton onClick={handleExpand} aria-label="expand">
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Stack>
        </Stack>

        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Box sx={{ mt: 3 }}>
            {loading && (
              <Typography>Loading credit card details...</Typography>
            )}
            
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            
            {stats && trend && (
              <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
                <Box sx={{ flex: 1 }}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Statistics
                    </Typography>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="body2" color="textSecondary">
                          Average Monthly Spending
                        </Typography>
                        <Typography variant="h6">
                          {formatCurrency(stats.avgMonthlySpending)}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="textSecondary">
                          Total Transactions (6 months)
                        </Typography>
                        <Typography variant="h6">
                          {stats.totalTransactions}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="textSecondary">
                          Period: {new Date(stats.periodStart).toLocaleDateString()} - {new Date(stats.periodEnd).toLocaleDateString()}
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                </Box>
                
                <Box sx={{ flex: 1 }}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TrendingUpIcon />
                      6-Month Trend
                    </Typography>
                    <CreditCardChart data={trend.months} />
                    <Box sx={{ mt: 2, textAlign: 'center' }}>
                      <Button
                        variant="outlined"
                        startIcon={<AnalyticsIcon />}
                        onClick={() => setShowMonthlyDetail(true)}
                      >
                        View Monthly Details
                      </Button>
                    </Box>
                  </Paper>
                </Box>
              </Box>
            )}
          </Box>
        </Collapse>
        
        <CreditCardMonthlyDetail
          open={showMonthlyDetail}
          onClose={() => setShowMonthlyDetail(false)}
          cardId={card._id}
          cardName={card.name}
        />
      </CardContent>
    </Card>
  );
};

export const CreditCardsList: React.FC = () => {
  const [creditCards, setCreditCards] = useState<CreditCardWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCreditCards = async () => {
    try {
      const data = await creditCardsApi.getAll();
      setCreditCards(data);
      setError('');
    } catch (err) {
      setError('Failed to load credit cards');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCreditCards();
  }, []);

  if (loading) {
    return <Typography>Loading credit cards...</Typography>;
  }

  if (error) {
    return (
      <Alert severity="error">
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Credit Cards
      </Typography>

      {creditCards.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <CreditCardIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography color="textSecondary" variant="h6" gutterBottom>
            No Credit Cards Found
          </Typography>
          <Typography color="textSecondary" variant="body2">
            Credit cards will appear here once they are detected from your bank account transactions.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={0}>
          {creditCards.map(card => (
            <CreditCardItem key={card._id} card={card} />
          ))}
        </Stack>
      )}
    </Box>
  );
};
