import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Skeleton,
  Alert,
  Tooltip as MuiTooltip,
} from '@mui/material';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { bankAccountsApi } from '../../services/api/bank';
import { foreignCurrencyApi } from '../../services/api/foreignCurrency';
import { investmentApi } from '../../services/api/investments';
import { pensionApi } from '../../services/api/pension';
import { realEstateApi } from '../../services/api/realEstate';
import { rsuApi } from '../../services/api/rsus';

// ---------- Types ----------

interface AssetSource {
  name: string;
  value: number;
  category: 'liquid' | 'mid-term' | 'long-term';
  color: string;
}

interface LiabilitySource {
  name: string;
  value: number;
  color: string;
}

interface NetWorthData {
  assets: AssetSource[];
  liabilities: LiabilitySource[];
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  loading: boolean;
  error: string | null;
}

// ---------- Color palette ----------

const CATEGORY_COLORS = {
  liquid: { main: '#42a5f5', light: '#90caf9' },
  'mid-term': { main: '#ab47bc', light: '#ce93d8' },
  'long-term': { main: '#26a69a', light: '#80cbc4' },
};

const SOURCE_ROUTES: Record<string, string> = {
  'Bank Accounts': '/banks',
  'Foreign Currency': '/foreign-currency',
  'RSU Portfolio': '/rsus',
  'Investments': '/investments',
  'Real Estate': '/real-estate',
  'Pension': '/pension',
};

const SOURCE_COLORS: Record<string, string> = {
  'Bank Accounts': '#1e88e5',
  'Foreign Currency': '#64b5f6',
  'RSU Portfolio': '#8e24aa',
  'Investments': '#ba68c8',
  'Real Estate': '#00897b',
  'Pension': '#4db6ac',
};

const LIABILITY_COLORS = {
  main: '#ef5350',
  light: '#e57373',
};

// ---------- Currency formatting ----------

const formatCurrency = (amount: number, currency = 'ILS'): string => {
  const locale = currency === 'ILS' ? 'he-IL' : 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatCompact = (amount: number, currency = 'ILS'): string => {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${(amount / 1_000).toFixed(0)}K`;
  }
  return formatCurrency(amount, currency);
};

// ---------- Custom tooltip ----------
// Recharts v3 shared <Tooltip> only works for one Pie at a time,
// so we manage hover state manually across all rings.

interface TooltipData {
  name: string;
  value: number;
  x: number;
  y: number;
}

// ---------- Data fetching hook ----------

function useNetWorthData(): NetWorthData {
  const [data, setData] = useState<NetWorthData>({
    assets: [],
    liabilities: [],
    totalAssets: 0,
    totalLiabilities: 0,
    netWorth: 0,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      try {
        const [
          balanceSummary,
          fxSummary,
          investmentSummary,
          pensionSummary,
          realEstateSummary,
          rsuSummary,
        ] = await Promise.allSettled([
          bankAccountsApi.getBalanceSummary(),
          foreignCurrencyApi.getCurrencySummary(),
          investmentApi.getPortfolioSummary(),
          pensionApi.getSummary(),
          realEstateApi.getSummary(),
          rsuApi.portfolio.getSummary(),
        ]);

        if (cancelled) return;

        const assets: AssetSource[] = [];
        let totalLiabilities = 0;

        // Bank accounts — Liquid
        if (balanceSummary.status === 'fulfilled') {
          const total = balanceSummary.value.reduce(
            (sum, item) => sum + item.convertedBalance,
            0
          );
          if (total !== 0) {
            assets.push({
              name: 'Bank Accounts',
              value: Math.max(total, 0),
              category: 'liquid',
              color: SOURCE_COLORS['Bank Accounts'],
            });
          }
        }

        // Foreign Currency — Liquid
        if (fxSummary.status === 'fulfilled') {
          const total = fxSummary.value.reduce(
            (sum, item) => sum + (item.totalBalanceILS || 0),
            0
          );
          if (total > 0) {
            assets.push({
              name: 'Foreign Currency',
              value: total,
              category: 'liquid',
              color: SOURCE_COLORS['Foreign Currency'],
            });
          }
        }

        // RSU Portfolio — Mid-term
        if (rsuSummary.status === 'fulfilled') {
          const total = rsuSummary.value?.summary?.totalPortfolioValue || 0;
          if (total > 0) {
            assets.push({
              name: 'RSU Portfolio',
              value: total,
              category: 'mid-term',
              color: SOURCE_COLORS['RSU Portfolio'],
            });
          }
        }

        // Investment accounts — Mid-term
        if (investmentSummary.status === 'fulfilled') {
          const total = investmentSummary.value?.totalValue || 0;
          if (total > 0) {
            assets.push({
              name: 'Investments',
              value: total,
              category: 'mid-term',
              color: SOURCE_COLORS['Investments'],
            });
          }
        }

        // Real Estate — Long-term (equity = estimatedValue - pending installments)
        if (realEstateSummary.status === 'fulfilled') {
          const summary = realEstateSummary.value;
          const equity = summary.totalEstimatedValue || 0;
          if (equity > 0) {
            assets.push({
              name: 'Real Estate',
              value: equity,
              category: 'long-term',
              color: SOURCE_COLORS['Real Estate'],
            });
          }
          // Liabilities: pending installments
          const pendingInstallments = summary.totalInstallments || 0;
          if (pendingInstallments > 0) {
            totalLiabilities += pendingInstallments;
          }
        }

        // Pension — Long-term
        if (pensionSummary.status === 'fulfilled') {
          const total = pensionSummary.value?.totalBalance || 0;
          if (total > 0) {
            assets.push({
              name: 'Pension',
              value: total,
              category: 'long-term',
              color: SOURCE_COLORS['Pension'],
            });
          }
        }

        const totalAssets = assets.reduce((s, a) => s + a.value, 0);
        const netWorth = totalAssets - totalLiabilities;

        setData({
          assets,
          liabilities:
            totalLiabilities > 0
              ? [{ name: 'RE Commitments', value: totalLiabilities, color: LIABILITY_COLORS.main }]
              : [],
          totalAssets,
          totalLiabilities,
          netWorth,
          loading: false,
          error: null,
        });
      } catch (err: any) {
        if (!cancelled) {
          setData((prev) => ({
            ...prev,
            loading: false,
            error: err.message || 'Failed to load net worth data',
          }));
        }
      }
    };

    fetchAll();
    return () => { cancelled = true; };
  }, []);

  return data;
}

// ---------- Main component ----------

const NetWorthDonutChart: React.FC = () => {
  const navigate = useNavigate();
  const data = useNetWorthData();
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const chartRef = React.useRef<HTMLDivElement>(null);

  const handleSliceClick = useCallback((entry: any) => {
    const route = SOURCE_ROUTES[entry.name];
    if (route) navigate(route);
  }, [navigate]);

  const handleCellMouseEnter = useCallback((entry: any, e: React.MouseEvent) => {
    if (entry.isFiller || entry.name === '_filler') return;
    const rect = chartRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltip({
        name: entry.name,
        value: entry.value,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  }, []);

  const handleCellMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  // Outer ring: asset categories (Liquid / Mid-term / Long-term)
  const outerRingData = useMemo(() => {
    const categories: Record<string, number> = {};
    data.assets.forEach((a) => {
      categories[a.category] = (categories[a.category] || 0) + a.value;
    });

    const result = [];
    if (categories['liquid'])
      result.push({ name: 'Liquid', value: categories['liquid'], color: CATEGORY_COLORS.liquid.main });
    if (categories['mid-term'])
      result.push({ name: 'Mid-term', value: categories['mid-term'], color: CATEGORY_COLORS['mid-term'].main });
    if (categories['long-term'])
      result.push({ name: 'Long-term', value: categories['long-term'], color: CATEGORY_COLORS['long-term'].main });
    return result;
  }, [data.assets]);

  // Middle ring: individual asset sources
  const middleRingData = useMemo(() => {
    return data.assets.map((a) => ({
      name: a.name,
      value: a.value,
      color: a.color,
    }));
  }, [data.assets]);

  // Inner ring: liabilities with transparent filler to show ratio vs assets
  const innerRingData = useMemo(() => {
    if (data.liabilities.length === 0 || data.totalAssets === 0) return [];
    const fillerValue = data.totalAssets - data.totalLiabilities;
    return [
      ...data.liabilities.map((l) => ({
        name: l.name,
        value: l.value,
        color: l.color,
        isFiller: false,
      })),
      ...(fillerValue > 0
        ? [{ name: '_filler', value: fillerValue, color: 'transparent', isFiller: true }]
        : []),
    ];
  }, [data.liabilities, data.totalAssets, data.totalLiabilities]);

  if (data.loading) {
    return (
      <Card sx={{ height: '100%', minHeight: 420 }}>
        <CardContent sx={{ p: 3 }}>
          <Skeleton variant="text" width="40%" height={32} />
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <Skeleton variant="circular" width={280} height={280} />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4, mt: 3 }}>
            <Skeleton variant="text" width={80} />
            <Skeleton variant="text" width={80} />
            <Skeleton variant="text" width={80} />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (data.error) {
    return (
      <Card sx={{ height: '100%', minHeight: 420 }}>
        <CardContent sx={{ p: 3 }}>
          <Alert severity="error">{data.error}</Alert>
        </CardContent>
      </Card>
    );
  }

  const hasData = data.assets.length > 0 || data.liabilities.length > 0;

  return (
    <Card sx={{ height: '100%', minHeight: 420 }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Net Worth
        </Typography>

        {!hasData ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
            <Typography color="text.secondary">
              No financial data available yet.
            </Typography>
          </Box>
        ) : (
          <>
            {/* Chart */}
            <Box ref={chartRef} sx={{ width: '100%', height: 320, position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  {/* Outer ring: Asset categories */}
                  <Pie
                    data={outerRingData}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    startAngle={90}
                    endAngle={-270}
                    outerRadius={150}
                    innerRadius={122}
                    paddingAngle={1}
                    strokeWidth={0}
                    isAnimationActive={false}
                  >
                    {outerRingData.map((entry, i) => (
                      <Cell
                        key={`outer-${i}`}
                        fill={entry.color}
                        onMouseEnter={(e: any) => handleCellMouseEnter(entry, e)}
                        onMouseLeave={handleCellMouseLeave}
                      />
                    ))}
                  </Pie>

                  {/* Middle ring: Individual sources (clickable) */}
                  <Pie
                    data={middleRingData}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    startAngle={90}
                    endAngle={-270}
                    outerRadius={118}
                    innerRadius={86}
                    paddingAngle={1}
                    strokeWidth={0}
                    isAnimationActive={false}
                  >
                    {middleRingData.map((entry, i) => (
                      <Cell
                        key={`mid-${i}`}
                        fill={entry.color}
                        cursor="pointer"
                        onClick={() => handleSliceClick(entry)}
                        onMouseEnter={(e: any) => handleCellMouseEnter(entry, e)}
                        onMouseLeave={handleCellMouseLeave}
                      />
                    ))}
                  </Pie>

                  {/* Inner ring: Liabilities */}
                  {innerRingData.length > 0 && (
                    <Pie
                      data={innerRingData}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      startAngle={90}
                      endAngle={-270}
                      outerRadius={82}
                      innerRadius={58}
                      paddingAngle={0}
                      strokeWidth={0}
                      isAnimationActive={false}
                    >
                      {innerRingData.map((entry, i) => (
                        <Cell
                          key={`inner-${i}`}
                          fill={entry.color}
                          onMouseEnter={(e: any) => handleCellMouseEnter(entry, e)}
                          onMouseLeave={handleCellMouseLeave}
                        />
                      ))}
                    </Pie>
                  )}

                </PieChart>
              </ResponsiveContainer>

              {/* Custom tooltip */}
              {tooltip && (
                <Box
                  sx={{
                    position: 'absolute',
                    left: tooltip.x + 12,
                    top: tooltip.y - 10,
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 2,
                    px: 1.5,
                    py: 1,
                    boxShadow: 3,
                    pointerEvents: 'none',
                    zIndex: 10,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Typography variant="body2" fontWeight={600}>
                    {tooltip.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatCurrency(tooltip.value)}
                  </Typography>
                </Box>
              )}

              {/* Center label — net worth */}
              <Box
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  pointerEvents: 'none',
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', lineHeight: 1.2, mb: 0.5 }}
                >
                  Net Worth
                </Typography>
                <Typography
                  variant="h6"
                  fontWeight={700}
                  sx={{ lineHeight: 1.1 }}
                >
                  {formatCompact(data.netWorth)}
                </Typography>
              </Box>
            </Box>

            {/* Summary line: Assets · Liabilities · Net */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                gap: { xs: 2, sm: 4 },
                mt: 1,
                flexWrap: 'wrap',
              }}
            >
              <MuiTooltip title={formatCurrency(data.totalAssets)} arrow>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Assets
                  </Typography>
                  <Typography variant="body2" fontWeight={600} color="success.main">
                    {formatCompact(data.totalAssets)}
                  </Typography>
                </Box>
              </MuiTooltip>

              {data.totalLiabilities > 0 && (
                <MuiTooltip title={formatCurrency(data.totalLiabilities)} arrow>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Liabilities
                    </Typography>
                    <Typography variant="body2" fontWeight={600} color="error.main">
                      {formatCompact(data.totalLiabilities)}
                    </Typography>
                  </Box>
                </MuiTooltip>
              )}

              <MuiTooltip title={formatCurrency(data.netWorth)} arrow>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Net
                  </Typography>
                  <Typography
                    variant="body2"
                    fontWeight={700}
                    color={data.netWorth >= 0 ? 'primary.main' : 'error.main'}
                  >
                    {formatCompact(data.netWorth)}
                  </Typography>
                </Box>
              </MuiTooltip>
            </Box>

            {/* Legend */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                flexWrap: 'wrap',
                gap: 1.5,
                mt: 2,
              }}
            >
              {outerRingData.map((entry) => (
                <Box key={entry.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      bgcolor: entry.color,
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {entry.name}
                  </Typography>
                </Box>
              ))}
              {innerRingData.length > 0 &&
                innerRingData
                  .filter((entry) => !entry.isFiller)
                  .map((entry) => (
                  <Box key={entry.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: entry.color,
                      }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {entry.name}
                    </Typography>
                  </Box>
                ))}
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default NetWorthDonutChart;
