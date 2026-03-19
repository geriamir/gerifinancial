import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
  Card
} from '@mui/material';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { investmentApi } from '../../services/api/investments';
import { PortfolioTimeline } from '../../services/api/types/investment';
import { formatCurrency } from '../../utils/formatters';

const TIMEFRAMES = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'ALL', days: 0 }
];

const COLORS = [
  '#2196f3', '#4caf50', '#ff9800', '#9c27b0', '#f44336',
  '#00bcd4', '#795548', '#607d8b', '#e91e63', '#3f51b5',
  '#8bc34a', '#ffc107', '#009688', '#ff5722', '#673ab7'
];

const CASH_COLOR = '#78909c';

const CustomTooltip = ({ active, payload, label, symbols, currency }: any) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  const dateLabel = new Date(data.date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });

  return (
    <Card sx={{ p: 1.5, maxWidth: 300, direction: 'ltr' }}>
      <Typography variant="caption" color="text.secondary">{dateLabel}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.5, mb: 1 }}>
        Total: {formatCurrency(data.total, currency)}
      </Typography>
      {symbols.map((sym: string, i: number) => {
        const val = data[sym] as number;
        if (!val || val === 0) return null;
        return (
          <Box key={sym} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: COLORS[i % COLORS.length] }} />
              <Typography variant="caption">{sym}</Typography>
            </Box>
            <Typography variant="caption" sx={{ fontWeight: 500 }}>
              {formatCurrency(val, currency)}
            </Typography>
          </Box>
        );
      })}
      {data.cash > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: CASH_COLOR }} />
            <Typography variant="caption">Cash</Typography>
          </Box>
          <Typography variant="caption" sx={{ fontWeight: 500 }}>
            {formatCurrency(data.cash, currency)}
          </Typography>
        </Box>
      )}
    </Card>
  );
};

interface PortfolioTimelineChartProps {
  currency?: string;
}

export const PortfolioTimelineChart: React.FC<PortfolioTimelineChartProps> = ({ currency = 'USD' }) => {
  const [timeline, setTimeline] = useState<PortfolioTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('1Y');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTimeline = async () => {
      setLoading(true);
      setError(null);
      try {
        const selectedTf = TIMEFRAMES.find(t => t.label === timeframe);
        const days = selectedTf?.days ?? 365;
        const data = await investmentApi.getPortfolioTimeline(days);
        setTimeline(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load portfolio timeline');
      } finally {
        setLoading(false);
      }
    };
    fetchTimeline();
  }, [timeframe]);

  const chartData = useMemo(() => {
    if (!timeline) return [];
    return timeline.series.map(point => ({
      ...point,
      dateLabel: new Date(point.date).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric'
      })
    }));
  }, [timeline]);

  const { totalChange, totalChangePercent } = useMemo(() => {
    if (!chartData.length) return { totalChange: 0, totalChangePercent: 0 };
    const first = chartData[0]?.total as number || 0;
    const last = chartData[chartData.length - 1]?.total as number || 0;
    const change = last - first;
    const pct = first !== 0 ? (change / first) * 100 : 0;
    return { totalChange: change, totalChangePercent: pct };
  }, [chartData]);

  const symbols = timeline?.symbols || [];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={36} />
      </Box>
    );
  }

  if (error) {
    return (
      <Typography variant="body2" color="error" sx={{ py: 4, textAlign: 'center' }}>
        {error}
      </Typography>
    );
  }

  if (chartData.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
        No portfolio history available yet
      </Typography>
    );
  }

  const lastTotal = chartData[chartData.length - 1]?.total as number || 0;
  const isPositive = totalChange >= 0;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {formatCurrency(lastTotal, currency)}
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: isPositive ? 'success.main' : 'error.main', fontWeight: 500, direction: 'ltr', unicodeBidi: 'bidi-override' }}
          >
            {isPositive ? '+' : ''}{formatCurrency(totalChange, currency)} ({isPositive ? '+' : ''}{totalChangePercent.toFixed(2)}%)
          </Typography>
        </Box>
        <ToggleButtonGroup
          value={timeframe}
          exclusive
          onChange={(_, v) => v && setTimeframe(v)}
          size="small"
        >
          {TIMEFRAMES.map(tf => (
            <ToggleButton key={tf.label} value={tf.label} sx={{ px: 1.5, py: 0.25, fontSize: '0.75rem' }}>
              {tf.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {/* Stacked Area Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <defs>
            {symbols.map((sym, i) => (
              <linearGradient key={sym} id={`color-${sym}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.05} />
              </linearGradient>
            ))}
            <linearGradient id="color-cash" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CASH_COLOR} stopOpacity={0.3} />
              <stop offset="95%" stopColor={CASH_COLOR} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={60}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => {
              const sym = currency === 'ILS' ? '₪' : currency === 'EUR' ? '€' : '$';
              if (v >= 1000000) return `${sym}${(v / 1000000).toFixed(1)}M`;
              if (v >= 1000) return `${sym}${(v / 1000).toFixed(0)}K`;
              return `${sym}${v}`;
            }}
            width={60}
          />
          <Tooltip content={<CustomTooltip symbols={symbols} currency={currency} />} />
          {/* Cash area at the bottom of the stack */}
          {timeline && timeline.cashBalance > 0 && (
            <Area
              type="monotone"
              dataKey="cash"
              stackId="portfolio"
              stroke={CASH_COLOR}
              strokeWidth={1}
              fill="url(#color-cash)"
            />
          )}
          {/* Position areas stacked */}
          {symbols.map((sym, i) => (
            <Area
              key={sym}
              type="monotone"
              dataKey={sym}
              stackId="portfolio"
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={1.5}
              fill={`url(#color-${sym})`}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 1.5, flexWrap: 'wrap' }}>
        {symbols.map((sym, i) => (
          <Box key={sym} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: COLORS[i % COLORS.length] }} />
            <Typography variant="caption">{sym}</Typography>
          </Box>
        ))}
        {timeline && timeline.cashBalance > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: CASH_COLOR }} />
            <Typography variant="caption">Cash</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};
