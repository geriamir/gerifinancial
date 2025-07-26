import React, { useMemo, useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  useTheme,
  Skeleton,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  Dot,
  Legend,
  Tooltip
} from 'recharts';
import { useRSU } from '../../contexts/RSUContext';
import { PortfolioTimelinePoint } from '../../services/api/rsus';

interface RSUVestingChartProps {
  height?: number;
}

const RSUVestingChart: React.FC<RSUVestingChartProps> = ({ height = 400 }) => {
  const theme = useTheme();
  const { grants, loading, getPortfolioTimeline } = useRSU();
  const [timeframe, setTimeframe] = useState<'1Y' | '2Y' | '5Y' | 'ALL'>('1Y');
  const [timelineData, setTimelineData] = useState<PortfolioTimelinePoint[]>([]);

  // Load timeline data when component mounts or timeframe changes
  useEffect(() => {
    const loadTimelineData = async () => {
      if (!grants || grants.length === 0) return;
      
      try {
        const response = await getPortfolioTimeline({ timeframe });
        setTimelineData(response.data);
      } catch (error) {
        console.error('Error loading timeline data:', error);
        setTimelineData([]);
      }
    };

    loadTimelineData();
  }, [grants, timeframe, getPortfolioTimeline]);

  const chartData = useMemo(() => {
    if (!timelineData || timelineData.length === 0) return [];

    return timelineData.map(point => ({
      month: point.month,
      monthKey: point.monthKey,
      cumulativeValue: point.totalNetValue, // Use net value (after taxes)
      vestingValue: point.events.reduce((sum, event) => {
        if (event.eventType === 'vesting') {
          return sum + (event.taxDetails?.netValue || 0);
        } else if (event.eventType === 'sale') {
          // Subtract sale proceeds (already net after taxes)
          return sum - (event.taxCalculation?.netValue || 0);
        }
        return sum;
      }, 0),
      isHistorical: point.isHistorical,
      isFuture: point.isFuture,
      isToday: point.isToday,
      events: point.events.map(event => ({
        grantId: event.grantId,
        stockSymbol: event.stockSymbol,
        eventType: event.eventType,
        shares: event.eventType === 'vesting' 
          ? (event.isCliffEvent 
              ? (event.sharesForCalculation || 0)  // For cliff: use accumulated shares that vested
              : (event.sharesVested || 0))  // For regular vesting: just the shares in this event
          : (event.sharesSold || 0),
        pricePerShare: event.pricePerShare,
        value: event.eventType === 'vesting' 
          ? (event.eventTaxDetails?.netValue || 0)  // Use individual event value, not accumulated
          : (event.taxCalculation?.netValue || 0),
        isCliff: event.isCliffEvent || false,
        isVesting: event.eventType === 'vesting',
        isSale: event.eventType === 'sale',
        eventTaxDetails: event.eventTaxDetails || null,
      })),
      grantBreakdown: point.grantBreakdown
    }));
  }, [timelineData]);

  // Custom dot component for highlighting special events
  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    
    if (!payload?.events || payload.events.length === 0) return null;
    
    const hasVesting = payload.events.some((event: any) => event.isVesting);
    const hasSale = payload.events.some((event: any) => event.isSale);
    const hasCliff = payload.events.some((event: any) => event.isCliff);
    
    // Skip if no events to show
    if (!hasVesting && !hasSale) return null;

    const dots = [];
    
    // If we have both vesting and sale, use concentric dots
    if (hasVesting && hasSale) {
      // Outer dot (larger) for vesting
      dots.push(
        <Dot 
          key="vesting-outer"
          cx={cx} 
          cy={cy} 
          r={hasCliff ? 10 : 7} 
          fill={hasCliff ? theme.palette.warning.main : theme.palette.primary.main}
          stroke={hasCliff ? theme.palette.warning.dark : theme.palette.primary.dark}
          strokeWidth={2}
        />
      );
      // Inner dot (smaller) for sale
      dots.push(
        <Dot 
          key="sale-inner"
          cx={cx} 
          cy={cy} 
          r={3} 
          fill={theme.palette.error.main}
          stroke={theme.palette.error.dark}
          strokeWidth={1}
        />
      );
    } else if (hasVesting) {
      // Only vesting event
      dots.push(
        <Dot 
          key="vesting"
          cx={cx} 
          cy={cy} 
          r={hasCliff ? 8 : 5} 
          fill={hasCliff ? theme.palette.warning.main : theme.palette.primary.main}
          stroke={hasCliff ? theme.palette.warning.dark : theme.palette.primary.dark}
          strokeWidth={2}
        />
      );
    } else if (hasSale) {
      // Only sale event
      dots.push(
        <Dot 
          key="sale"
          cx={cx} 
          cy={cy} 
          r={5} 
          fill={theme.palette.error.main}
          stroke={theme.palette.error.dark}
          strokeWidth={2}
        />
      );
    }

    return <g>{dots}</g>;
  };

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            RSU Vesting Timeline
          </Typography>
          <Skeleton variant="rectangular" height={height} />
        </CardContent>
      </Card>
    );
  }

  // No data state
  if (chartData.length === 0) {
    return (
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="h6" gutterBottom>
            RSU Vesting Timeline
          </Typography>
          <Typography variant="body2" color="text.secondary">
            No RSU grants found. Add your first grant to see the vesting timeline.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  // Custom tooltip component
  const CustomTooltip = (props: any) => {
    const { active, payload, label } = props;
    
    if (!active || !payload || !payload[0]) return null;
    
    const data = payload[0].payload;
    const cumulativeValue = data.cumulativeValue;
    const events = data.events || [];
    
    return (
      <Box sx={{ 
        bgcolor: 'background.paper', 
        p: 2, 
        border: 1, 
        borderColor: 'divider',
        borderRadius: 1,
        boxShadow: 3,
        minWidth: 250
      }}>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
          {label}
        </Typography>
        
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="primary.main" sx={{ fontWeight: 'medium', fontSize: '1rem' }}>
            Portfolio Value (Post-Tax): ${cumulativeValue.toLocaleString()}
          </Typography>
        </Box>

        {events.length > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
              Events ({events.length} total):
            </Typography>
            <Box sx={{ mt: 1 }}>
              {(() => {
                // Group events by type
                const vestingEvents = events.filter((e: any) => e.isVesting && !e.isCliff);
                const cliffEvents = events.filter((e: any) => e.isCliff);
                const saleEvents = events.filter((e: any) => e.isSale);
                
                const eventGroups = [];
                
                // Regular vesting events
                if (vestingEvents.length > 0) {
                  const totalShares = vestingEvents.reduce((sum: number, e: any) => sum + e.shares, 0);
                  const totalValue = vestingEvents.reduce((sum: number, e: any) => sum + e.value, 0);
                  const symbols = Array.from(new Set(vestingEvents.map((e: any) => e.stockSymbol)));
                  
                  eventGroups.push(
                    <Box key="vesting" sx={{ 
                      mb: 1, 
                      p: 1, 
                      bgcolor: 'action.hover',
                      borderRadius: 0.5,
                      borderLeft: 3,
                      borderColor: 'primary.main'
                    }}>
                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        📈 {symbols.join(', ')}: {totalShares.toLocaleString()} shares
                        <Typography component="span" variant="caption" color="primary.main" sx={{ ml: 1, fontWeight: 'bold' }}>
                          (Vesting - {vestingEvents.length} events)
                        </Typography>
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Net value (post-tax): ${totalValue.toLocaleString()}
                      </Typography>
                    </Box>
                  );
                }
                
                // Cliff events - Simplified to show only net value
                if (cliffEvents.length > 0) {
                  const totalShares = cliffEvents.reduce((sum: number, e: any) => sum + e.shares, 0);
                  const totalNetValue = cliffEvents.reduce((sum: number, e: any) => sum + e.value, 0);
                  const symbols = Array.from(new Set(cliffEvents.map((e: any) => e.stockSymbol)));
                  
                  eventGroups.push(
                    <Box key="cliff" sx={{ 
                      mb: 1, 
                      p: 1, 
                      bgcolor: 'warning.light',
                      borderRadius: 0.5,
                      borderLeft: 3,
                      borderColor: 'warning.main'
                    }}>
                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        🎯 {symbols.join(', ')}: {totalShares.toLocaleString()} shares
                        <Typography component="span" variant="caption" color="warning.main" sx={{ ml: 1, fontWeight: 'bold' }}>
                          (2-Year Cliff - {cliffEvents.length} events)
                        </Typography>
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Net value (post-tax): ${totalNetValue.toLocaleString()}
                      </Typography>
                    </Box>
                  );
                }
                
                // Sale events
                if (saleEvents.length > 0) {
                  const totalShares = saleEvents.reduce((sum: number, e: any) => sum + Math.abs(e.shares), 0);
                  const totalValue = saleEvents.reduce((sum: number, e: any) => sum + Math.abs(e.value), 0);
                  const symbols = Array.from(new Set(saleEvents.map((e: any) => e.stockSymbol)));
                  
                  eventGroups.push(
                    <Box key="sale" sx={{ 
                      mb: 1, 
                      p: 1, 
                      bgcolor: 'error.light',
                      borderRadius: 0.5,
                      borderLeft: 3,
                      borderColor: 'error.main'
                    }}>
                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        💰 {symbols.join(', ')}: {totalShares.toLocaleString()} shares
                        <Typography component="span" variant="caption" color="error.main" sx={{ ml: 1, fontWeight: 'bold' }}>
                          (Sale - {saleEvents.length} events)
                        </Typography>
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Net proceeds: ${totalValue.toLocaleString()}
                      </Typography>
                    </Box>
                  );
                }
                
                return eventGroups;
              })()}
            </Box>
          </Box>
        )}
      </Box>
    );
  };

  const todayPoint = chartData.find(point => point.isToday);

  return (
    <Card>
      <CardContent>
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              RSU Vesting Timeline
            </Typography>
            <ToggleButtonGroup
              value={timeframe}
              exclusive
              onChange={(_, newTimeframe) => {
                if (newTimeframe) setTimeframe(newTimeframe);
              }}
              size="small"
            >
              <ToggleButton value="1Y">1Y</ToggleButton>
              <ToggleButton value="2Y">2Y</ToggleButton>
              <ToggleButton value="5Y">5Y</ToggleButton>
              <ToggleButton value="ALL">ALL</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Event-driven timeline showing accurate portfolio evolution with proper tax calculations. 
            Each point represents actual vesting and sale events at their true market values.
          </Typography>
        </Box>

        <Box sx={{ width: '100%', height }}>
          <ResponsiveContainer>
            <LineChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
                stroke={theme.palette.text.secondary}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                stroke={theme.palette.text.secondary}
                tickFormatter={(value: number) => `$${(value / 1000).toFixed(0)}k`}
              />
              
              {/* Today reference line */}
              {todayPoint && (
                <ReferenceLine 
                  x={todayPoint.month} 
                  stroke={theme.palette.info.main}
                  strokeDasharray="5 5"
                  label={{ value: "Today", position: "top" }}
                />
              )}

              {/* Historical line (solid) */}
              <Line
                type="monotone"
                dataKey="cumulativeValue"
                stroke={theme.palette.primary.main}
                strokeWidth={3}
                dot={false}
                connectNulls={false}
                name="Cumulative Post-Tax Value"
              />

              {/* Custom dots for vesting events */}
              <Line
                type="monotone"
                dataKey="cumulativeValue"
                stroke="transparent"
                dot={<CustomDot />}
                strokeWidth={0}
                legendType="none"
              />

              {/* Custom Tooltip */}
              <Tooltip content={<CustomTooltip />} />

              <Legend />
            </LineChart>
          </ResponsiveContainer>
        </Box>

        {/* Chart legend/info */}
        <Box sx={{ 
          mt: 2, 
          display: 'flex', 
          gap: 3, 
          flexWrap: 'wrap',
          justifyContent: 'center',
          fontSize: '0.875rem'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ 
              width: 12, 
              height: 12, 
              borderRadius: '50%', 
              bgcolor: theme.palette.primary.main 
            }} />
            <Typography variant="caption">Vesting Events</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ 
              width: 12, 
              height: 12, 
              borderRadius: '50%', 
              bgcolor: theme.palette.warning.main 
            }} />
            <Typography variant="caption">2-Year Cliffs</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ 
              width: 12, 
              height: 12, 
              borderRadius: '50%', 
              bgcolor: theme.palette.error.main 
            }} />
            <Typography variant="caption">Sale Events</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ 
              width: 20, 
              height: 2, 
              bgcolor: theme.palette.info.main,
              borderStyle: 'dashed',
              borderWidth: '1px 0'
            }} />
            <Typography variant="caption">Today</Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default RSUVestingChart;
