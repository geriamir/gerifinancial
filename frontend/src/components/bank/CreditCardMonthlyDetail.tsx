import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Paper,
  List,
  ListItem,
  ListItemText,
  Chip,
  CircularProgress,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tabs,
  Tab
} from '@mui/material';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import { creditCardsApi } from '../../services/api/creditCards';
import { CreditCardMonthlyStats, CategoryBreakdown } from '../../services/api/types/creditCard';
import { formatCurrency } from '../../utils/formatters';
import TransactionsList from '../transactions/TransactionsList';
import TransactionDetailDialog from '../transactions/TransactionDetailDialog';
import type { TransactionFilters, Transaction } from '../../services/api/types/transactions';

interface CreditCardMonthlyDetailProps {
  open: boolean;
  onClose: () => void;
  cardId: string;
  cardName: string;
}

const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8',
  '#82CA9D', '#FFC658', '#FF7C7C', '#8DD1E1', '#D084D0'
];

const getRandomColor = (index: number) => COLORS[index % COLORS.length];

// Component to fetch and display credit card transactions
interface CreditCardTransactionsListProps {
  cardId: string;
  year: number;
  month: number;
}

const CreditCardTransactionsList: React.FC<CreditCardTransactionsListProps> = ({
  cardId,
  year,
  month
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const fetchTransactions = useCallback(async () => {
    if (!cardId) return;
    
    setLoading(true);
    setError('');
    try {
      // Calculate start and end dates for the month
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      
      const response = await creditCardsApi.getTransactions(cardId, {
        startDate,
        endDate,
        limit: 1000 // Load all transactions for the month (set high limit)
      });
      
      setTransactions(response.transactions);
    } catch (err) {
      setError('Failed to load transactions');
      console.error('Error fetching credit card transactions:', err);
    } finally {
      setLoading(false);
    }
  }, [cardId, year, month]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

const handleTransactionClick = (transaction: Transaction) => {
  setSelectedTransaction(transaction);
  setDetailDialogOpen(true);
};

const handleTransactionUpdated = (updatedTransaction: Transaction) => {
  setTransactions(prev => 
    prev.map(t => t._id === updatedTransaction._id ? updatedTransaction : t)
  );
  setSelectedTransaction(updatedTransaction);
};

const handleCloseDetailDialog = () => {
  setDetailDialogOpen(false);
  setSelectedTransaction(null);
};

if (loading) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
      <CircularProgress />
    </Box>
  );
}

if (error) {
  return (
    <Alert severity="error" sx={{ mt: 2 }}>
      {error}
    </Alert>
  );
}

if (transactions.length === 0) {
  return (
    <Alert severity="info" sx={{ mt: 2 }}>
      No transactions found for this period.
    </Alert>
  );
}

return (
  <>
    <TransactionsList 
      transactions={transactions} 
      onRowClick={handleTransactionClick}
    />
    <TransactionDetailDialog
      open={detailDialogOpen}
      transaction={selectedTransaction}
      onClose={handleCloseDetailDialog}
      onTransactionUpdated={handleTransactionUpdated}
    />
  </>
);
};

export const CreditCardMonthlyDetail: React.FC<CreditCardMonthlyDetailProps> = ({
  open,
  onClose,
  cardId,
  cardName
}) => {
  const [monthlyStats, setMonthlyStats] = useState<CreditCardMonthlyStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [activeTab, setActiveTab] = useState(0);

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const fetchMonthlyStats = async () => {
    if (!cardId) return;
    
    setLoading(true);
    setError('');
    try {
      const data = await creditCardsApi.getMonthlyStats(cardId, selectedYear, selectedMonth);
      console.log('API Response:', data);
      console.log('Category Breakdown:', data.categoryBreakdown);
      if (data.categoryBreakdown && data.categoryBreakdown.length > 0) {
        console.log('First item:', data.categoryBreakdown[0]);
      }
      setMonthlyStats(data);
    } catch (err) {
      setError('Failed to load monthly statistics');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && cardId) {
      fetchMonthlyStats();
    }
  }, [open, cardId, selectedYear, selectedMonth]);

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
  };

  const handleMonthChange = (month: number) => {
    setSelectedMonth(month);
  };

  const preparePieData = (categoryBreakdown: CategoryBreakdown[]) => {
    if (!categoryBreakdown || !Array.isArray(categoryBreakdown)) {
      return [];
    }
    return categoryBreakdown.slice(0, 8).map((item, index) => ({
      name: item.subCategoryName || item.categoryName || item.subCategory || item.category || 'Uncategorized',
      value: item.totalAmount || 0,
      color: getRandomColor(index),
      percentage: item.percentage || 0
    }));
  };

  const prepareBarData = (categoryBreakdown: CategoryBreakdown[]) => {
    if (!categoryBreakdown || !Array.isArray(categoryBreakdown)) {
      return [];
    }
    return categoryBreakdown.slice(0, 10).map(item => {
      const displayName = item.subCategoryName || item.categoryName || item.subCategory || item.category;
      const truncatedName = displayName && displayName.length > 15 ? displayName.substring(0, 15) + '...' : displayName || 'Unknown';
      return {
        name: truncatedName,
        amount: item.totalAmount,
        count: item.transactionCount
      };
    });
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <Box sx={{ 
          backgroundColor: 'background.paper', 
          p: 1, 
          border: 1, 
          borderColor: 'divider',
          borderRadius: 1
        }}>
          <Typography variant="body2" fontWeight="bold">
            {data.payload.name}
          </Typography>
          <Typography variant="body2" color="primary">
            Amount: {formatCurrency(data.value)}
          </Typography>
          {data.payload.percentage && (
            <Typography variant="body2" color="textSecondary">
              {data.payload.percentage.toFixed(1)}% of total
            </Typography>
          )}
        </Box>
      );
    }
    return null;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth aria-labelledby="credit-card-monthly-dialog-title">
      <DialogTitle id="credit-card-monthly-dialog-title">
        Monthly Details - {cardName}
        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Year</InputLabel>
            <Select
              value={selectedYear}
              label="Year"
              onChange={(e) => handleYearChange(Number(e.target.value))}
            >
              {years.map(year => (
                <MenuItem key={year} value={year}>{year}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Month</InputLabel>
            <Select
              value={selectedMonth}
              label="Month"
              onChange={(e) => handleMonthChange(Number(e.target.value))}
            >
              {months.map(month => (
                <MenuItem key={month.value} value={month.value}>
                  {month.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        )}
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {monthlyStats && !loading && (
          <Box>
            {/* Summary Card */}
            <Paper sx={{ p: 2, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                {monthlyStats.monthName} {monthlyStats.year} Summary
              </Typography>
              <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Total Spending
                  </Typography>
                  <Typography variant="h4" color="primary">
                    {formatCurrency(monthlyStats.totalAmount)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Total Transactions
                  </Typography>
                  <Typography variant="h4">
                    {monthlyStats.transactionCount}
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {/* Tabs */}
            <Paper sx={{ mb: 3 }}>
              <Tabs 
                value={activeTab} 
                onChange={(_, newValue) => setActiveTab(newValue)}
                indicatorColor="primary"
                textColor="primary"
              >
                <Tab label="Analytics" />
                <Tab label="Transactions" />
              </Tabs>
            </Paper>

            {/* Tab Content */}
            {activeTab === 0 && monthlyStats.categoryBreakdown && monthlyStats.categoryBreakdown.length > 0 && (
              <>
                <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
                  <Box sx={{ flex: 1 }}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="h6" gutterBottom>
                        Spending by Category (Top 8)
                      </Typography>
                      <Box sx={{ height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={preparePieData(monthlyStats.categoryBreakdown)}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {preparePieData(monthlyStats.categoryBreakdown).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </Box>
                    </Paper>
                  </Box>
                  
                  <Box sx={{ flex: 1 }}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="h6" gutterBottom>
                        Amount by Category (Top 10)
                      </Typography>
                      <Box sx={{ height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={prepareBarData(monthlyStats.categoryBreakdown)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="name" 
                              angle={-45}
                              textAnchor="end"
                              height={80}
                              fontSize={10}
                            />
                            <YAxis tickFormatter={(value) => formatCurrency(value)} />
                            <Tooltip 
                              formatter={(value: number) => [formatCurrency(value), 'Amount']}
                              labelFormatter={(label) => `Category: ${label}`}
                            />
                            <Bar dataKey="amount" fill="#1976d2" />
                          </BarChart>
                        </ResponsiveContainer>
                      </Box>
                    </Paper>
                  </Box>
                </Box>

                <Paper sx={{ p: 2, mt: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Category Breakdown
                  </Typography>
                  <List>
                    {monthlyStats.categoryBreakdown.map((item, index) => (
                      <ListItem 
                        key={`${item.categoryName}-${item.subCategoryName || 'main'}`}
                        sx={{ 
                          border: 1, 
                          borderColor: 'divider', 
                          borderRadius: 1, 
                          mb: 1 
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body1">
                                {item.subCategoryName || item.categoryName || item.subCategory || item.category || 'Uncategorized'}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                <Chip 
                                  label={`${item.transactionCount || 0} transactions`}
                                  size="small"
                                  variant="outlined"
                                />
                                <Chip 
                                  label={`${(item.percentage || 0).toFixed(1)}%`}
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                />
                                <Typography variant="h6" color="primary">
                                  {formatCurrency(item.totalAmount || 0)}
                                </Typography>
                              </Box>
                            </Box>
                          }
                          secondary={(item.subCategoryName || item.subCategory) ? `Category: ${item.categoryName || item.category || 'Unknown'}` : ''}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              </>
            )}

            {activeTab === 1 && (
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Transactions for {monthlyStats.monthName} {monthlyStats.year}
                </Typography>
                <CreditCardTransactionsList 
                  cardId={cardId}
                  year={selectedYear}
                  month={selectedMonth}
                />
              </Paper>
            )}
          </Box>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
