import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Skeleton,
  Alert,
  Tooltip as MuiTooltip,
  useTheme,
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
import { PRODUCT_TYPE_LABELS } from '../../services/api/types/pension';

// ---------- Types ----------

interface AssetSource {
  name: string;
  value: number;
  originalValue?: number;
  originalCurrency?: string;
  category: 'liquid' | 'mid-term' | 'long-term';
  color: string;
  route?: string;
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

// Per-category color palettes for individual items (darkest → lightest)
const CATEGORY_PALETTES: Record<string, string[]> = {
  liquid: ['#0d47a1', '#1565c0', '#1976d2', '#1e88e5', '#2196f3', '#42a5f5', '#64b5f6', '#90caf9'],
  'mid-term': ['#4a148c', '#6a1b9a', '#7b1fa2', '#8e24aa', '#9c27b0', '#ab47bc', '#ba68c8', '#ce93d8'],
  'long-term': ['#004d40', '#00695c', '#00796b', '#00897b', '#009688', '#26a69a', '#4db6ac', '#80cbc4'],
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
  originalValue?: number;
  originalCurrency?: string;
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
          investmentsResult,
          pensionSummary,
          realEstateList,
          rsuSummary,
          exchangeRatesResult,
        ] = await Promise.allSettled([
          bankAccountsApi.getBalanceSummary(),
          foreignCurrencyApi.getCurrencySummary(),
          investmentApi.getUserInvestments(),
          pensionApi.getSummary(),
          realEstateApi.getAll(),
          rsuApi.portfolio.getSummary(),
          foreignCurrencyApi.getExchangeRates({ baseCurrency: 'ILS' }),
        ]);

        if (cancelled) return;

        // Build exchange rate lookup (currency → ILS multiplier)
        const rates: Record<string, number> = { ILS: 1 };
        if (exchangeRatesResult.status === 'fulfilled') {
          for (const r of exchangeRatesResult.value.rates || []) {
            if (r.toCurrency && r.rate) {
              rates[r.toCurrency] = 1 / r.rate;
            }
          }
        }
        const toILS = (amount: number, currency: string): number => {
          if (!currency || currency === 'ILS') return amount;
          const rate = rates[currency];
          return rate ? amount * rate : amount;
        };

        const assets: AssetSource[] = [];
        let totalLiabilities = 0;

        // ---------- Bank accounts — Liquid (per account) ----------
        if (balanceSummary.status === 'fulfilled') {
          for (const acct of balanceSummary.value) {
            const converted = acct.convertedBalance || 0;
            if (converted <= 0) continue;
            assets.push({
              name: acct.accountName || `Account ${acct.bankAccountId}`,
              value: converted,
              originalValue: acct.balance,
              originalCurrency: acct.currency,
              category: 'liquid',
              color: '', // assigned later
              route: '/banks',
            });
          }
        }

        // ---------- Foreign Currency — Liquid ----------
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
              color: '',
              route: '/foreign-currency',
            });
          }
        }

        // ---------- RSU Portfolio — Mid-term ----------
        if (rsuSummary.status === 'fulfilled') {
          const total = rsuSummary.value?.summary?.vestedLiquidValue || 0;
          if (total > 0) {
            assets.push({
              name: 'RSU Portfolio',
              value: total,
              category: 'mid-term',
              color: '',
              route: '/rsus',
            });
          }
        }

        // ---------- Investments — grouped by bank account; pure money-market accounts → liquid, rest → mid-term ----------
        if (investmentsResult.status === 'fulfilled') {
          const investments = investmentsResult.value.investments || [];

          // Group by bankAccountId (same logic as InvestmentAccountList)
          const acctGroups = new Map<string, {
            name: string;
            currency: string;
            mmILS: number;
            otherILS: number;
            cashILS: number;
            originalTotal: number;
          }>();

          for (const inv of investments) {
            if (inv.status !== 'active') continue;
            const key = typeof inv.bankAccountId === 'object'
              ? (inv.bankAccountId as any)?._id
              : inv.bankAccountId;
            const invCurrency = inv.currency || 'ILS';

            let group = acctGroups.get(key);
            if (!group) {
              const bankName = typeof inv.bankAccountId === 'object'
                ? (inv.bankAccountId as any)?.name
                : undefined;
              group = {
                name: bankName || inv.accountName || `Account ${inv.accountNumber}`,
                currency: invCurrency,
                mmILS: 0,
                otherILS: 0,
                cashILS: 0,
                originalTotal: 0,
              };
              acctGroups.set(key, group);
            }

            group.cashILS += toILS(inv.cashBalance || 0, invCurrency);
            group.originalTotal += inv.totalMarketValue || inv.totalValue || 0;

            for (const h of inv.holdings || []) {
              const hCurrency = h.currency || invCurrency;
              const val = toILS(
                h.marketValue || (h.quantity * (h.currentPrice || 0)),
                hCurrency
              );
              if (h.holdingType === 'money_market') {
                group.mmILS += val;
              } else {
                group.otherILS += val;
              }
            }
          }

          acctGroups.forEach((g) => {
            const total = g.mmILS + g.otherILS + g.cashILS;
            if (total <= 0) return;
            const isAllMoneyMarket = g.otherILS === 0 && g.mmILS > 0;
            assets.push({
              name: g.name,
              value: total,
              originalValue: g.originalTotal,
              originalCurrency: g.currency,
              category: isAllMoneyMarket ? 'liquid' : 'mid-term',
              color: '',
              route: '/investments',
            });
          });
        }

        // ---------- Real Estate — Long-term (per project) ----------
        if (realEstateList.status === 'fulfilled') {
          for (const project of realEstateList.value) {
            if (project.status === 'cancelled') continue;
            const reCurrency = project.currency || 'ILS';
            const equity = toILS(project.estimatedCurrentValue || 0, reCurrency);
            if (equity > 0) {
              assets.push({
                name: project.name || 'RE Project',
                value: equity,
                originalValue: project.estimatedCurrentValue,
                originalCurrency: reCurrency,
                category: 'long-term',
                color: '',
                route: `/real-estate/${project._id}`,
              });
            }
            // Liabilities: pending installments
            const pending = toILS(project.totalPendingInstallments || 0, reCurrency);
            if (pending > 0) {
              totalLiabilities += pending;
            }
          }
        }

        // ---------- Pension — Long-term (grouped by type+provider+owner) ----------
        if (pensionSummary.status === 'fulfilled') {
          const penCurrency = pensionSummary.value?.currency || 'ILS';
          const pensionGroups: Record<string, { ils: number; original: number }> = {};
          for (const group of pensionSummary.value?.groups || []) {
            for (const acct of group.accounts || []) {
              if ((acct.balance || 0) <= 0) continue;
              const typeLabel = PRODUCT_TYPE_LABELS[group.productType] || group.productType;
              const key = [typeLabel, acct.provider, acct.owner].filter(Boolean).join(' · ');
              if (!pensionGroups[key]) pensionGroups[key] = { ils: 0, original: 0 };
              pensionGroups[key].ils += toILS(acct.balance || 0, penCurrency);
              pensionGroups[key].original += acct.balance || 0;
            }
          }
          for (const [name, totals] of Object.entries(pensionGroups)) {
            if (totals.ils <= 0) continue;
            assets.push({
              name,
              value: totals.ils,
              originalValue: totals.original,
              originalCurrency: penCurrency,
              category: 'long-term',
              color: '',
              route: '/pension',
            });
          }
        }

        // ---------- Assign colors per category ----------
        const categoryIndices: Record<string, number> = {};
        // Sort by category order then by value desc within category
        const catOrder: Record<string, number> = { liquid: 0, 'mid-term': 1, 'long-term': 2 };
        assets.sort((a, b) => {
          const catDiff = (catOrder[a.category] ?? 9) - (catOrder[b.category] ?? 9);
          if (catDiff !== 0) return catDiff;
          return b.value - a.value; // larger first within category
        });
        for (const asset of assets) {
          const idx = categoryIndices[asset.category] || 0;
          const palette = CATEGORY_PALETTES[asset.category] || CATEGORY_PALETTES.liquid;
          asset.color = palette[idx % palette.length];
          categoryIndices[asset.category] = idx + 1;
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
  const theme = useTheme();
  const data = useNetWorthData();
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const chartRef = React.useRef<HTMLDivElement>(null);
  const strokeColor = theme.palette.background.paper;

  const handleSliceClick = useCallback((entry: any) => {
    const route = entry.route;
    if (route) navigate(route);
  }, [navigate]);

  const handleCellMouseEnter = useCallback((entry: any, e: React.MouseEvent) => {
    if (entry.isFiller || entry.name === '_filler') return;
    const rect = chartRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltip({
        name: entry.name,
        value: entry.value,
        originalValue: entry.originalValue,
        originalCurrency: entry.originalCurrency,
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

  // Middle ring: individual asset sources (already sorted by category in hook)
  const middleRingData = useMemo(() => {
    return data.assets.map((a) => ({
      name: a.name,
      value: a.value,
      color: a.color,
      originalValue: a.originalValue,
      originalCurrency: a.originalCurrency,
      route: a.route,
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
                    paddingAngle={0}
                    strokeWidth={0}
                    isAnimationActive={false}
                  >
                    {outerRingData.map((entry, i) => (
                      <Cell
                        key={`outer-${i}`}
                        fill={entry.color}
                        stroke={strokeColor}
                        strokeWidth={2}
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
                    paddingAngle={0}
                    strokeWidth={0}
                    isAnimationActive={false}
                  >
                    {middleRingData.map((entry, i) => (
                      <Cell
                        key={`mid-${i}`}
                        fill={entry.color}
                        stroke={strokeColor}
                        strokeWidth={2}
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
                  {tooltip.originalCurrency && tooltip.originalCurrency !== 'ILS' && tooltip.originalValue != null ? (
                    <>
                      <Typography variant="body2" color="text.secondary">
                        {formatCurrency(tooltip.originalValue, tooltip.originalCurrency)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        ≈ {formatCurrency(tooltip.value)}
                      </Typography>
                    </>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {formatCurrency(tooltip.value)}
                    </Typography>
                  )}
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
