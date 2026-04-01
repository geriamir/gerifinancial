import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Skeleton,
  Alert,
  useTheme,
  alpha,
  Divider,
} from '@mui/material';
import {
  TrendingUp as SavingsIcon,
  Business as ProjectIcon,
  EventNote as VestingIcon,
} from '@mui/icons-material';
import { budgetsApi } from '../../services/api/budgets';
import { rsuApi } from '../../services/api/rsus';

// ---------- Types ----------

interface YearlyData {
  activeProjects: Array<{ name: string; total: number; spent: number; currency: string }>;
  totalProjectBudget: number;
  totalProjectSpent: number;
  upcomingVesting: Array<{ date: string; shares: number; estimatedValue: number }>;
  totalVestingValue: number;
  projectedMonthlySavings: number;
  projectedYearlySavings: number;
}

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
  const symbol = currency === 'ILS' ? '₪' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : `${currency} `;
  if (abs >= 1_000_000) return `${symbol}${(amount / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${symbol}${(amount / 1_000).toFixed(0)}K`;
  return formatCurrency(amount, currency);
};

// ---------- Stat row component ----------

interface StatRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
}

const StatRow: React.FC<StatRowProps> = ({ icon, label, value, sub, color }) => {
  const theme = useTheme();
  const mode = theme.palette.mode;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5 }}>
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: alpha(color, mode === 'dark' ? 0.15 : 0.08),
          color,
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="body2" fontWeight={700}>
          {value}
        </Typography>
        {sub && (
          <Typography variant="caption" color="text.secondary">
            {sub}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

// ---------- Main component ----------

const YearlyFinancialOutlook: React.FC = () => {
  const theme = useTheme();
  const [data, setData] = useState<YearlyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const remainingMonths = 12 - month + 1;

        const [dashboardResult, vestingResult, budgetResult] = await Promise.allSettled([
          budgetsApi.getDashboardOverview(),
          rsuApi.vesting.getUpcoming(365),
          budgetsApi.getBudgetSummary(year, month),
        ]);

        if (cancelled) return;

        // Projects
        let activeProjects: YearlyData['activeProjects'] = [];
        let totalProjectBudget = 0;
        let totalProjectSpent = 0;

        if (dashboardResult.status === 'fulfilled') {
          const resp = dashboardResult.value as any;
          const d = resp.data || resp;
          const projects = d.activeProjects || [];

          activeProjects = projects.slice(0, 3).map((p: any) => ({
            name: p.name || 'Unnamed',
            total: p.totalBudget || p.totalInvestment || 0,
            spent: p.totalSpent || p.totalPaid || 0,
            currency: p.currency || 'ILS',
          }));

          totalProjectBudget = d.totalActiveProjectBudget || projects.reduce(
            (s: number, p: any) => s + (p.totalBudget || p.totalInvestment || 0),
            0
          );
          totalProjectSpent = projects.reduce(
            (s: number, p: any) => s + (p.totalSpent || p.totalPaid || 0),
            0
          );
        }

        // RSU Vesting
        let upcomingVesting: YearlyData['upcomingVesting'] = [];
        let totalVestingValue = 0;

        if (vestingResult.status === 'fulfilled') {
          const events = vestingResult.value || [];
          upcomingVesting = events.slice(0, 3).map((e: any) => ({
            date: e.vestingDate || e.date,
            shares: e.sharesVesting || e.shares || 0,
            estimatedValue: e.estimatedValue || e.value || 0,
          }));
          totalVestingValue = events.reduce(
            (s: number, e: any) => s + (e.estimatedValue || e.value || 0),
            0
          );
        }

        // Monthly savings projection
        let projectedMonthlySavings = 0;
        if (budgetResult.status === 'fulfilled') {
          const resp = budgetResult.value as any;
          const d = resp.data || resp;
          if (d.monthly) {
            const monthlyIncome = d.monthly.totalActualIncome || d.monthly.totalBudgetedIncome || 0;
            const monthlyExpenses = d.monthly.totalActualExpenses || d.monthly.totalBudgetedExpenses || 0;
            projectedMonthlySavings = monthlyIncome - monthlyExpenses;
          }
        }

        setData({
          activeProjects,
          totalProjectBudget,
          totalProjectSpent,
          upcomingVesting,
          totalVestingValue,
          projectedMonthlySavings,
          projectedYearlySavings: projectedMonthlySavings * remainingMonths,
        });
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to load yearly outlook');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent sx={{ p: 3 }}>
          <Skeleton variant="text" width="50%" height={28} />
          {[1, 2, 3].map((i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1.5, mt: 2 }}>
              <Skeleton variant="rounded" width={36} height={36} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="60%" />
                <Skeleton variant="text" width="40%" />
              </Box>
            </Box>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent sx={{ p: 3 }}>
          <Alert severity="error">{error}</Alert>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const year = new Date().getFullYear();

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {year} Outlook
        </Typography>

        {/* Projected savings */}
        {data.projectedMonthlySavings !== 0 && (
          <StatRow
            icon={<SavingsIcon sx={{ fontSize: 18 }} />}
            label="Projected Savings"
            value={formatCompact(data.projectedYearlySavings)}
            sub={`~${formatCurrency(data.projectedMonthlySavings)}/mo`}
            color={theme.palette.success.main}
          />
        )}

        {/* Active projects */}
        {data.activeProjects.length > 0 && (
          <>
            <Divider sx={{ my: 0.5 }} />
            <StatRow
              icon={<ProjectIcon sx={{ fontSize: 18 }} />}
              label="Active Projects"
              value={`${data.activeProjects.length} projects`}
              sub={`${formatCurrency(totalSpentDisplay(data))} of ${formatCurrency(data.totalProjectBudget)} allocated`}
              color={theme.palette.primary.main}
            />
            {data.activeProjects.map((p) => (
              <Box key={p.name} sx={{ pl: 6.5, pb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {p.name}
                </Typography>
                <Typography variant="caption" sx={{ ml: 1 }}>
                  {formatCurrency(p.spent, p.currency)} / {formatCurrency(p.total, p.currency)}
                </Typography>
              </Box>
            ))}
          </>
        )}

        {/* RSU Vesting */}
        {data.upcomingVesting.length > 0 && (
          <>
            <Divider sx={{ my: 0.5 }} />
            <StatRow
              icon={<VestingIcon sx={{ fontSize: 18 }} />}
              label="Upcoming RSU Vesting"
              value={formatCompact(data.totalVestingValue, 'USD')}
              sub={`${data.upcomingVesting.length} event${data.upcomingVesting.length > 1 ? 's' : ''} this year`}
              color={theme.palette.secondary.main}
            />
          </>
        )}

        {/* Empty state */}
        {data.activeProjects.length === 0 &&
          data.upcomingVesting.length === 0 &&
          data.projectedMonthlySavings === 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 100 }}>
              <Typography color="text.secondary" variant="body2">
                No yearly projections available yet.
              </Typography>
            </Box>
          )}
      </CardContent>
    </Card>
  );
};

function totalSpentDisplay(data: YearlyData): number {
  return data.totalProjectSpent;
}

export default YearlyFinancialOutlook;
