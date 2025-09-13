import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
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
  InputLabel
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
  Tooltip,
  Legend
} from 'recharts';
import { creditCardsApi } from '../../services/api/creditCards';
import { CreditCardMonthlyStats, CategoryBreakdown } from '../../services/api/types/creditCard';
import { formatCurrency } from '../../utils/formatters';

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
    return categoryBreakdown.slice(0, 8).map((item, index) => ({
      name: item.subCategory || item.category,
      value: item.totalAmount,
      color: getRandomColor(index),
      percentage: item.percentage
    }));
  };

  const prepareBarData = (categoryBreakdown: CategoryBreakdown[]) => {
    return categoryBreakdown.slice(0, 10).map(item => {
      const displayName = item.subCategory || item.category;
      const truncatedName = displayName.length > 15 ? displayName.substring(0, 15) + '...' : displayName;
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
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Typography variant="h6">
          Monthly Details - {cardName}
        </Typography>
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

            {monthlyStats.categoryBreakdown.length > 0 && (
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
                        key={`${item.category}-${item.subCategory || 'main'}`}
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
                                {item.subCategory || item.category}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                <Chip 
                                  label={`${item.transactionCount} transactions`}
                                  size="small"
                                  variant="outlined"
                                />
                                <Chip 
                                  label={`${item.percentage.toFixed(1)}%`}
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                />
                                <Typography variant="h6" color="primary">
                                  {formatCurrency(item.totalAmount)}
                                </Typography>
                              </Box>
                            </Box>
                          }
                          secondary={item.subCategory ? `Category: ${item.category}` : ''}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              </>
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
