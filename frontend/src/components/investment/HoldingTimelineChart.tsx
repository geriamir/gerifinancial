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
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { investmentApi } from '../../services/api/investments';
import { HoldingTimeline, TimelineEvent } from '../../services/api/types/investment';
import { formatCurrency } from '../../utils/formatters';

interface HoldingTimelineChartProps {
  symbol: string;
  currency: string;
}

interface ChartDataPoint {
  date: string;
  dateLabel: string;
  holdingValue: number | null;
  price: number | null;
  quantity: number;
  buyEvent?: TimelineEvent;
  sellEvent?: TimelineEvent;
  dividendEvent?: TimelineEvent;
}

const TIMEFRAMES = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'ALL', days: 0 }
];

const CustomTooltip = ({ active, payload, currency }: any) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload as ChartDataPoint;
  if (!data) return null;

  const events = [data.buyEvent, data.sellEvent, data.dividendEvent].filter(Boolean) as TimelineEvent[];

  return (
    <Card sx={{ p: 1.5, maxWidth: 280 }}>
      <Typography variant="caption" color="text.secondary">{data.dateLabel}</Typography>
      {data.holdingValue != null && (
        <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
          Value: {formatCurrency(data.holdingValue, currency)}
        </Typography>
      )}
      {data.price != null && (
        <Typography variant="caption" display="block" color="text.secondary">
          {data.quantity} shares × {formatCurrency(data.price, currency)}
        </Typography>
      )}
      {events.map((evt, i) => (
        <Box key={i} sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
          <Typography
            variant="caption"
            sx={{ fontWeight: 600 }}
            color={evt.type === 'BUY' ? 'success.main' : evt.type === 'SELL' ? 'error.main' : 'info.main'}
          >
            {evt.type}
          </Typography>
          <Typography variant="caption" display="block">
            {evt.shares} shares @ {formatCurrency(evt.pricePerShare, currency)}
          </Typography>
          <Typography variant="caption" display="block">
            Total: {formatCurrency(Math.abs(evt.value), currency)}
          </Typography>
        </Box>
      ))}
    </Card>
  );
};

const EventDot = (props: any) => {
  const { cx, cy, payload } = props;
  if (!cx || !cy) return null;

  const hasBuy = !!payload?.buyEvent;
  const hasSell = !!payload?.sellEvent;
  const hasDividend = !!payload?.dividendEvent;

  if (!hasBuy && !hasSell && !hasDividend) return null;

  const color = hasBuy ? '#4caf50' : hasSell ? '#f44336' : '#2196f3';
  const size = 6;

  return (
    <g>
      <circle cx={cx} cy={cy} r={size + 2} fill={color} opacity={0.2} />
      <circle cx={cx} cy={cy} r={size} fill={color} stroke="white" strokeWidth={2} />
      {/* Show both colors for same-day buy+sell */}
      {hasBuy && hasSell && (
        <circle cx={cx} cy={cy} r={3} fill="#f44336" />
      )}
    </g>
  );
};

export const HoldingTimelineChart: React.FC<HoldingTimelineChartProps> = ({ symbol, currency }) => {
  const [timeline, setTimeline] = useState<HoldingTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('1Y');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTimeline = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await investmentApi.getHoldingTimeline(symbol);
        setTimeline(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load timeline');
      } finally {
        setLoading(false);
      }
    };
    fetchTimeline();
  }, [symbol]);

  const chartData = useMemo((): ChartDataPoint[] => {
    if (!timeline) return [];

    // Determine date cutoff based on timeframe
    const selectedTf = TIMEFRAMES.find(t => t.label === timeframe);
    let cutoffDate: string | null = null;
    if (selectedTf && selectedTf.days !== 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - selectedTf.days);
      cutoffDate = cutoff.toISOString().split('T')[0];
    }

    // Build event lookup by date string (YYYY-MM-DD)
    const eventsByDate = new Map<string, TimelineEvent[]>();
    for (const evt of timeline.events) {
      const key = new Date(evt.date).toISOString().split('T')[0];
      if (!eventsByDate.has(key)) eventsByDate.set(key, []);
      eventsByDate.get(key)!.push(evt);
    }

    // Build chart data from price history
    const points: ChartDataPoint[] = timeline.priceHistory.map(p => {
      const dateKey = new Date(p.date).toISOString().split('T')[0];
      const dateLabel = new Date(p.date).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: '2-digit'
      });
      const dayEvents = eventsByDate.get(dateKey) || [];

      return {
        date: dateKey,
        dateLabel,
        holdingValue: p.holdingValue,
        price: p.price,
        quantity: p.quantity,
        buyEvent: dayEvents.find(e => e.type === 'BUY'),
        sellEvent: dayEvents.find(e => e.type === 'SELL'),
        dividendEvent: dayEvents.find(e => e.type === 'DIVIDEND')
      };
    });

    // Add events that fall on dates without price data (weekends, etc.)
    const priceKeys = new Set(points.map(p => p.date));
    eventsByDate.forEach((evts, dateKey) => {
      if (!priceKeys.has(dateKey)) {
        const dateLabel = new Date(dateKey).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: '2-digit'
        });
        points.push({
          date: dateKey,
          dateLabel,
          holdingValue: null,
          price: evts[0]?.pricePerShare || null,
          quantity: 0,
          buyEvent: evts.find(e => e.type === 'BUY'),
          sellEvent: evts.find(e => e.type === 'SELL'),
          dividendEvent: evts.find(e => e.type === 'DIVIDEND')
        });
      }
    });

    points.sort((a, b) => a.date.localeCompare(b.date));

    // Filter by timeframe
    if (cutoffDate) {
      return points.filter(p => p.date >= cutoffDate!);
    }
    return points;
  }, [timeline, timeframe]);

  const valueRange = useMemo(() => {
    const values = chartData.filter(d => d.holdingValue != null).map(d => d.holdingValue!);
    if (values.length === 0) return { min: 0, max: 100 };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.1 || 5;
    return { min: Math.floor(min - padding), max: Math.ceil(max + padding) };
  }, [chartData]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (error) {
    return (
      <Typography variant="caption" color="error" sx={{ py: 2, display: 'block', textAlign: 'center' }}>
        {error}
      </Typography>
    );
  }

  if (chartData.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary" sx={{ py: 2, display: 'block', textAlign: 'center' }}>
        No price history available for {symbol}
      </Typography>
    );
  }

  return (
    <Box>
      {/* Header with timeframe selector */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {symbol} Holding Value
        </Typography>
        <ToggleButtonGroup
          value={timeframe}
          exclusive
          onChange={(_, v) => v && setTimeframe(v)}
          size="small"
        >
          {TIMEFRAMES.map(tf => (
            <ToggleButton key={tf.label} value={tf.label} sx={{ px: 1.5, py: 0.25, fontSize: '0.7rem' }}>
              {tf.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={50}
          />
          <YAxis
            domain={[valueRange.min, valueRange.max]}
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`}
            width={60}
          />
          <Tooltip content={<CustomTooltip currency={currency} />} />
          <Line
            type="monotone"
            dataKey="holdingValue"
            stroke="#2196f3"
            strokeWidth={2}
            dot={<EventDot />}
            activeDot={{ r: 4, fill: '#2196f3' }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#4caf50' }} />
          <Typography variant="caption">Buy</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#f44336' }} />
          <Typography variant="caption">Sell</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#2196f3' }} />
          <Typography variant="caption">Dividend</Typography>
        </Box>
      </Box>
    </Box>
  );
};
