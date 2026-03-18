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
  Tooltip,
  ReferenceLine
} from 'recharts';
import { investmentApi } from '../../services/api/investments';
import { HoldingTimeline, TimelineEvent, CoveredCall } from '../../services/api/types/investment';
import { formatCurrency } from '../../utils/formatters';

interface HoldingTimelineChartProps {
  symbol: string;
  currency: string;
}

interface ChartDataPoint {
  date: string;
  dateLabel: string;
  price: number | null;
  quantity: number;
  holdingValue: number | null;
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

const formatExpiry = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: '2-digit' });
};

const CustomTooltip = ({ active, payload, currency }: any) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload as ChartDataPoint;
  if (!data) return null;

  const events = [data.buyEvent, data.sellEvent, data.dividendEvent].filter(Boolean) as TimelineEvent[];

  return (
    <Card sx={{ p: 1.5, maxWidth: 280 }}>
      <Typography variant="caption" color="text.secondary">{data.dateLabel}</Typography>
      {data.price != null && (
        <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
          {formatCurrency(data.price, currency)} / share
        </Typography>
      )}
      {data.holdingValue != null && data.quantity > 0 && (
        <Typography variant="caption" display="block" color="text.secondary">
          {data.quantity} shares · {formatCurrency(data.holdingValue, currency)} total
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

  const priceRange = useMemo(() => {
    const prices = chartData.filter(d => d.price != null).map(d => d.price!);
    if (prices.length === 0) return { min: 0, max: 100 };

    // Include strike prices in range calculation
    const strikes = (timeline?.coveredCalls || []).map(cc => cc.strikePrice);
    const allValues = [...prices, ...strikes];
    const rangeMin = Math.min(...allValues);
    const rangeMax = Math.max(...allValues);

    const padding = (rangeMax - rangeMin) * 0.1 || 5;
    return { min: Math.floor(rangeMin - padding), max: Math.ceil(rangeMax + padding) };
  }, [chartData, timeline]);

  // Current position summary from latest data point
  const currentPosition = useMemo(() => {
    const latest = [...chartData].reverse().find(d => d.price != null && d.quantity > 0);
    if (!latest) return null;
    return {
      quantity: latest.quantity,
      price: latest.price!,
      totalValue: latest.holdingValue!
    };
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

  const coveredCalls: CoveredCall[] = timeline?.coveredCalls || [];

  return (
    <Box>
      {/* Header with position summary and timeframe selector */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {symbol} Price
          </Typography>
          {currentPosition && (
            <Typography variant="caption" color="text.secondary">
              {currentPosition.quantity} shares · {formatCurrency(currentPosition.totalValue, currency)} total
            </Typography>
          )}
        </Box>
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
            domain={[priceRange.min, priceRange.max]}
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => `$${v}`}
            width={55}
          />
          <Tooltip content={<CustomTooltip currency={currency} />} />
          {/* Covered call strike lines */}
          {coveredCalls.map((cc, i) => (
            <ReferenceLine
              key={`cc-${i}`}
              y={cc.strikePrice}
              stroke="#ff9800"
              strokeDasharray="6 3"
              strokeWidth={2}
              label={{
                value: `Call $${cc.strikePrice} (exp ${formatExpiry(cc.expirationDate)})`,
                position: 'right',
                fill: '#ff9800',
                fontSize: 11
              }}
            />
          ))}
          <Line
            type="monotone"
            dataKey="price"
            stroke="#2196f3"
            strokeWidth={2}
            dot={<EventDot />}
            activeDot={{ r: 4, fill: '#2196f3' }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 1, flexWrap: 'wrap' }}>
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
        {coveredCalls.length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 16, height: 2, bgcolor: '#ff9800', borderTop: '2px dashed #ff9800' }} />
            <Typography variant="caption">Covered Call</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};
