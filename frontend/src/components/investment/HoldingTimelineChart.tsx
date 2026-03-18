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
  price: number | null;
  projectedPrice: number | null;
  strikePrice: number | null;
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
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
};

const CustomTooltip = ({ active, payload, currency }: any) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload as ChartDataPoint;
  if (!data) return null;

  const events = [data.buyEvent, data.sellEvent, data.dividendEvent].filter(Boolean) as TimelineEvent[];
  const displayPrice = data.price ?? data.projectedPrice;
  const isProjected = data.price == null && data.projectedPrice != null;

  return (
    <Card sx={{ p: 1.5, maxWidth: 280 }}>
      <Typography variant="caption" color="text.secondary">{data.dateLabel}</Typography>
      {displayPrice != null && (
        <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
          {formatCurrency(displayPrice, currency)} / share
          {isProjected && <Typography component="span" variant="caption" color="text.secondary"> (projected)</Typography>}
        </Typography>
      )}
      {displayPrice != null && data.quantity > 0 && (
        <Typography variant="caption" display="block" color="text.secondary">
          {data.quantity} shares · {formatCurrency(data.quantity * displayPrice, currency)} total
        </Typography>
      )}
      {data.strikePrice != null && (
        <Typography variant="caption" display="block" sx={{ color: '#ff9800', fontWeight: 500, mt: 0.5 }}>
          Call strike: {formatCurrency(data.strikePrice, currency)}
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

    // Build covered call date ranges for strike line rendering
    const coveredCalls = timeline.coveredCalls || [];
    const ccRanges = coveredCalls.map(cc => ({
      start: cc.sellDate ? new Date(cc.sellDate).toISOString().split('T')[0] : null,
      end: new Date(cc.expirationDate).toISOString().split('T')[0],
      strikePrice: cc.strikePrice
    }));

    const getStrikeForDate = (dateKey: string): number | null => {
      for (const r of ccRanges) {
        if (r.start && dateKey >= r.start && dateKey <= r.end) return r.strikePrice;
      }
      return null;
    };

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
        price: p.price,
        projectedPrice: null,
        strikePrice: getStrikeForDate(dateKey),
        holdingValue: p.holdingValue,
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
          price: evts[0]?.pricePerShare || null,
          projectedPrice: null,
          strikePrice: getStrikeForDate(dateKey),
          holdingValue: null,
          quantity: 0,
          buyEvent: evts.find(e => e.type === 'BUY'),
          sellEvent: evts.find(e => e.type === 'SELL'),
          dividendEvent: evts.find(e => e.type === 'DIVIDEND')
        });
      }
    });

    points.sort((a, b) => a.date.localeCompare(b.date));

    // Extend with projected (dotted) line to the latest covered call expiry
    if (coveredCalls.length > 0 && points.length > 0) {
      const latestExpiry = coveredCalls.reduce((latest, cc) => {
        const exp = new Date(cc.expirationDate).toISOString().split('T')[0];
        return exp > latest ? exp : latest;
      }, '');

      const lastPoint = points[points.length - 1];
      const lastDate = lastPoint.date;
      const lastPrice = lastPoint.price;

      if (latestExpiry > lastDate && lastPrice != null) {
        // Set projectedPrice on the last real point to connect the lines
        lastPoint.projectedPrice = lastPrice;

        // Add projected points (weekdays only) from last real date to expiry
        const current = new Date(lastDate);
        current.setDate(current.getDate() + 1);
        const expiryDate = new Date(latestExpiry);

        while (current <= expiryDate) {
          const day = current.getDay();
          if (day !== 0 && day !== 6) {
            const dateKey = current.toISOString().split('T')[0];
            const dateLabel = current.toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: '2-digit'
            });
            points.push({
              date: dateKey,
              dateLabel,
              price: null,
              projectedPrice: lastPrice,
              strikePrice: getStrikeForDate(dateKey),
              holdingValue: null,
              quantity: lastPoint.quantity
            });
          }
          current.setDate(current.getDate() + 1);
        }
      }
    }

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
    // Compute avg cost from the first covered call's parent holding data, or from timeline
    const costBasis = timeline?.priceHistory?.length
      ? (() => {
          // Sum up all BUY transaction values and shares for avg cost
          const buys = (timeline?.events || []).filter(e => e.type === 'BUY');
          if (buys.length === 0) return null;
          const totalCost = buys.reduce((sum, e) => sum + Math.abs(e.value), 0);
          const totalShares = buys.reduce((sum, e) => sum + e.shares, 0);
          return totalShares > 0 ? totalCost / totalShares : null;
        })()
      : null;
    return {
      quantity: latest.quantity,
      price: latest.price!,
      totalValue: latest.holdingValue!,
      avgCost: costBasis
    };
  }, [chartData, timeline]);

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

  const coveredCalls = timeline?.coveredCalls || [];

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
              {currentPosition.avgCost != null && ` · Avg Cost: ${formatCurrency(currentPosition.avgCost, currency)}`}
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
          {/* Stock price line (solid) */}
          <Line
            type="monotone"
            dataKey="price"
            stroke="#2196f3"
            strokeWidth={2}
            dot={<EventDot />}
            activeDot={{ r: 4, fill: '#2196f3' }}
            connectNulls={false}
          />
          {/* Projected price line (dotted, extends to expiry) */}
          <Line
            type="monotone"
            dataKey="projectedPrice"
            stroke="#2196f3"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
            activeDot={false}
            connectNulls
          />
          {/* Covered call strike line (only between sell date and expiry) */}
          {coveredCalls.length > 0 && (
            <Line
              type="stepAfter"
              dataKey="strikePrice"
              stroke="#ff9800"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              activeDot={false}
              connectNulls
            />
          )}
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
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 16, height: 0, borderTop: '2px dashed #ff9800' }} />
              <Typography variant="caption">
                Call ${coveredCalls[0].strikePrice} (exp {formatExpiry(coveredCalls[0].expirationDate)})
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 16, height: 0, borderTop: '2px dashed #2196f3' }} />
              <Typography variant="caption">Projected</Typography>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
};
