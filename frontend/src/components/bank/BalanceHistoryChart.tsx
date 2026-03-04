import React, { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { bankAccountsApi } from '../../services/api/bank';
import { BalanceSnapshot } from '../../services/api/types/bankAccount';
import { formatCurrency } from '../../utils/formatters';

interface BalanceHistoryChartProps {
  accountId: string;
  currency?: string;
  days?: number;
}

const CustomTooltip = ({ active, payload, label, currency }: any) => {
  if (active && payload && payload.length) {
    return (
      <Box sx={{
        backgroundColor: 'background.paper',
        p: 1,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1
      }}>
        <Typography variant="body2" fontWeight="bold">{label}</Typography>
        <Typography variant="body2" color="primary">
          {formatCurrency(payload[0].value, currency || 'ILS')}
        </Typography>
        {payload[0].payload.dayChange !== 0 && (
          <Typography
            variant="caption"
            color={payload[0].payload.dayChange >= 0 ? 'success.main' : 'error.main'}
          >
            {payload[0].payload.dayChange >= 0 ? '+' : ''}
            {formatCurrency(payload[0].payload.dayChange, currency || 'ILS')}
            {' '}({payload[0].payload.dayChangePercent.toFixed(1)}%)
          </Typography>
        )}
      </Box>
    );
  }
  return null;
};

export const BalanceHistoryChart: React.FC<BalanceHistoryChartProps> = ({
  accountId,
  currency = 'ILS',
  days = 30
}) => {
  const [data, setData] = useState<BalanceSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const history = await bankAccountsApi.getBalanceHistory(accountId, days);
        setData(history);
      } catch (err) {
        console.error('Failed to load balance history:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [accountId, days]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (data.length === 0) {
    return (
      <Typography variant="body2" color="textSecondary" sx={{ py: 1 }}>
        No balance history available yet.
      </Typography>
    );
  }

  const chartData = data.map(snapshot => ({
    date: new Date(snapshot.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    balance: snapshot.balance,
    dayChange: snapshot.dayChange,
    dayChangePercent: snapshot.dayChangePercent
  }));

  return (
    <Box sx={{ width: '100%', height: 200, mt: 1 }}>
      <ResponsiveContainer>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(value: number) => formatCurrency(value, currency)}
          />
          <Tooltip content={<CustomTooltip currency={currency} />} />
          <Line
            type="monotone"
            dataKey="balance"
            stroke="#1976d2"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
};
