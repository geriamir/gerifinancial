/**
 * NAVIGATION SIMPLIFICATION - Component Status
 * 
 * Status: ⏳ IN PROGRESS
 * Phase: 1
 * Last Updated: July 23, 2025
 * 
 * Implementation Notes:
 * - Recent activity timeline component for enhanced Overview page
 * - Displays last 7 days of transactions using real API data
 * - Grouped by date with category indicators and amounts
 * - Quick action buttons for categorization and details
 * - Integrates with existing transactionsApi service
 * - Testing status: Pending
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  Chip,
  IconButton,
  Divider,
  Button,
  Skeleton,
  Alert
} from '@mui/material';
import {
  Edit as EditIcon,
  Visibility as ViewIcon,
  ArrowForward as ArrowIcon,
  TrendingDown as ExpenseIcon,
  TrendingUp as IncomeIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { transactionsApi } from '../../services/api/transactions';
import type { Transaction } from '../../services/api/types/transactions';

interface DayGroup {
  date: string;
  displayDate: string;
  transactions: Transaction[];
  totalIncome: number;
  totalExpenses: number;
}

interface RecentActivityTimelineProps {
  maxDays?: number;
  maxTransactionsPerDay?: number;
  onCategorizeTransaction?: (transactionId: string) => void;
  onViewDetails?: (transactionId: string) => void;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
};

const formatRelativeDate = (dateString: string): string => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('he-IL', { 
      weekday: 'long', 
      month: 'short', 
      day: 'numeric' 
    });
  }
};

const groupTransactionsByDate = (transactions: Transaction[], maxPerDay: number): DayGroup[] => {
  const groups: { [key: string]: DayGroup } = {};
  
  transactions.forEach(transaction => {
    const date = new Date(transaction.date);
    const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    if (!groups[dateKey]) {
      groups[dateKey] = {
        date: dateKey,
        displayDate: formatRelativeDate(dateKey),
        transactions: [],
        totalIncome: 0,
        totalExpenses: 0
      };
    }
    
    // Limit transactions per day
    if (groups[dateKey].transactions.length < maxPerDay) {
      groups[dateKey].transactions.push(transaction);
    }
    
    if (transaction.type === 'Income') {
      groups[dateKey].totalIncome += transaction.amount;
    } else {
      groups[dateKey].totalExpenses += Math.abs(transaction.amount);
    }
  });
  
  return Object.values(groups).sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
};

const isUncategorized = (transaction: Transaction): boolean => {
  return !transaction.category || !transaction.subCategory;
};

export const RecentActivityTimeline: React.FC<RecentActivityTimelineProps> = ({
  maxDays = 7,
  maxTransactionsPerDay = 5,
  onCategorizeTransaction,
  onViewDetails
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  
  useEffect(() => {
    const fetchRecentTransactions = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch transactions from the last week
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - maxDays);
        
        const response = await transactionsApi.getTransactions({
          startDate,
          endDate,
          limit: 50 // Get enough transactions to fill the timeline
        });
        
        setTransactions(response.transactions);
      } catch (err) {
        console.error('Error fetching recent transactions:', err);
        setError('Failed to load recent transactions');
      } finally {
        setLoading(false);
      }
    };
    
    fetchRecentTransactions();
  }, [maxDays]);
  
  const handleCategorize = (transactionId: string) => {
    if (onCategorizeTransaction) {
      onCategorizeTransaction(transactionId);
    } else {
      // Default action - navigate to transactions with filter
      navigate(`/transactions?transaction=${transactionId}&action=categorize`);
    }
  };
  
  const handleViewDetails = (transactionId: string) => {
    if (onViewDetails) {
      onViewDetails(transactionId);
    } else {
      // Default action - navigate to transactions with detail view
      navigate(`/transactions?transaction=${transactionId}&action=view`);
    }
  };
  
  const handleViewAllTransactions = () => {
    navigate('/transactions');
  };
  
  if (loading) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recent Activity
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[1, 2, 3].map((day) => (
              <Box key={day}>
                <Skeleton variant="text" width="30%" height={24} sx={{ mb: 1 }} />
                {[1, 2].map((transaction) => (
                  <Box key={transaction} sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                    <Skeleton variant="circular" width={24} height={24} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton variant="text" width="60%" height={16} />
                      <Skeleton variant="text" width="40%" height={14} />
                    </Box>
                    <Skeleton variant="text" width="15%" height={16} />
                  </Box>
                ))}
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recent Activity
          </Typography>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Button 
            variant="outlined" 
            onClick={() => window.location.reload()}
            fullWidth
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  const dayGroups = groupTransactionsByDate(transactions, maxTransactionsPerDay);
  
  if (dayGroups.length === 0) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          textAlign: 'center',
          minHeight: 200
        }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No recent activity
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Connect your bank accounts to see recent transactions here.
          </Typography>
          <Button 
            variant="outlined" 
            onClick={() => navigate('/transactions?tab=bank-management')}
          >
            Connect Bank Account
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">
            Recent Activity
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Last {maxDays} days
          </Typography>
        </Box>
        
        <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
          {dayGroups.map((dayGroup, dayIndex) => (
            <Box key={dayGroup.date}>
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                mb: 1,
                mt: dayIndex > 0 ? 2 : 0
              }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  {dayGroup.displayDate}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {dayGroup.totalIncome > 0 && (
                    <Chip 
                      label={`+${formatCurrency(dayGroup.totalIncome)}`}
                      size="small"
                      color="success"
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  )}
                  {dayGroup.totalExpenses > 0 && (
                    <Chip 
                      label={`-${formatCurrency(dayGroup.totalExpenses)}`}
                      size="small"
                      color="error"
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  )}
                </Box>
              </Box>
              
              <List sx={{ p: 0 }}>
                {dayGroup.transactions.map((transaction) => (
                  <ListItem
                    key={transaction._id}
                    sx={{
                      p: 1,
                      borderRadius: 1,
                      mb: 0.5,
                      '&:hover': {
                        backgroundColor: 'action.hover'
                      }
                    }}
                  >
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      width: '100%',
                      gap: 1
                    }}>
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        backgroundColor: transaction.type === 'Income' ? 'success.light' : 'error.light'
                      }}>
                        {transaction.type === 'Income' ? (
                          <IncomeIcon sx={{ fontSize: 12, color: 'success.main' }} />
                        ) : (
                          <ExpenseIcon sx={{ fontSize: 12, color: 'error.main' }} />
                        )}
                      </Box>
                      
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {transaction.description}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
                          {transaction.category && transaction.subCategory && !isUncategorized(transaction) && (
                            <Chip
                              label={transaction.subCategory.name || transaction.category.name}
                              size="small"
                              variant="outlined"
                              sx={{ height: 16, fontSize: '0.65rem' }}
                            />
                          )}
                          {isUncategorized(transaction) && (
                            <Chip
                              label="Uncategorized"
                              size="small"
                              color="warning"
                              sx={{ height: 16, fontSize: '0.65rem' }}
                            />
                          )}
                        </Box>
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontWeight: 600,
                            color: transaction.type === 'Income' ? 'success.main' : 'error.main',
                            minWidth: 'fit-content'
                          }}
                        >
                          {transaction.type === 'Income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                        </Typography>
                        
                        {isUncategorized(transaction) && (
                          <IconButton
                            size="small"
                            onClick={() => handleCategorize(transaction._id)}
                            sx={{ ml: 0.5 }}
                          >
                            <EditIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        )}
                        
                        <IconButton
                          size="small"
                          onClick={() => handleViewDetails(transaction._id)}
                        >
                          <ViewIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Box>
                    </Box>
                  </ListItem>
                ))}
              </List>
              
              {dayIndex < dayGroups.length - 1 && (
                <Divider sx={{ my: 1 }} />
              )}
            </Box>
          ))}
        </Box>
        
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          mt: 2, 
          pt: 1, 
          borderTop: 1, 
          borderColor: 'divider' 
        }}>
          <Button
            variant="text"
            endIcon={<ArrowIcon />}
            onClick={handleViewAllTransactions}
            size="small"
          >
            View All Transactions
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default RecentActivityTimeline;
