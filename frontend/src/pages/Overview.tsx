/**
 * Financial Overview — Dashboard Redesign
 *
 * Layout (desktop):
 * ┌─────────────────────────┬──────────────────┐
 * │  Net Worth Donut (2x)   │  Monthly Budget   │
 * │  3-ring + summary       │  Status           │
 * ├────────────┬────────────┼──────────────────┤
 * │  Yearly    │  Action    │                   │
 * │  Outlook   │  Items     │  Recent Activity  │
 * │            │            │  (spans rows 2-3) │
 * └────────────┴────────────┴──────────────────┘
 */

import React from 'react';
import { Container, Typography, Box } from '@mui/material';

import NetWorthDonutChart from '../components/overview/NetWorthDonutChart';
import MonthlyBudgetStatus from '../components/overview/MonthlyBudgetStatus';
import YearlyFinancialOutlook from '../components/overview/YearlyFinancialOutlook';
import ActionItemsList from '../components/overview/ActionItemsList';
import RecentActivityTimeline from '../components/overview/RecentActivityTimeline';

const Overview: React.FC = () => {
  return (
    <Container maxWidth="xl">
      <Box sx={{ mt: 4, mb: 4 }}>
        {/* Page Header */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" gutterBottom>
            Financial Overview
          </Typography>
        </Box>

        {/* ═══ Row 1: Net Worth + Monthly Budget ═══ */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
            gap: 3,
            mb: 3,
          }}
        >
          <NetWorthDonutChart />
          <MonthlyBudgetStatus />
        </Box>

        {/* ═══ Rows 2-3: Yearly + Action Items + Recent Activity (tall) ═══ */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: '1fr 1fr 1fr' },
            gridTemplateRows: { lg: 'auto' },
            gap: 3,
          }}
        >
          {/* Yearly Outlook */}
          <Box sx={{ order: { xs: 2, lg: 1 } }}>
            <YearlyFinancialOutlook />
          </Box>

          {/* Action Items */}
          <Box sx={{ order: { xs: 3, lg: 2 } }}>
            <ActionItemsList maxItems={6} />
          </Box>

          {/* Recent Activity — spans full right column on desktop */}
          <Box
            sx={{
              order: { xs: 1, lg: 3 },
              gridRow: { lg: '1 / span 1' },
            }}
          >
            <RecentActivityTimeline maxDays={14} />
          </Box>
        </Box>
      </Box>
    </Container>
  );
};

export default Overview;
