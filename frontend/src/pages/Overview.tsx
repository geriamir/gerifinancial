/**
 * NAVIGATION SIMPLIFICATION - Completed
 * 
 * Implementation Notes:
 * - Enhanced Overview page replacing Dashboard
 * - Combines existing Dashboard functionality with new components
 * - Integrates FinancialSummaryCards, ActionItemsList, and RecentActivityTimeline
 * - Maintains UncategorizedTransactionsWidget for backward compatibility
 * - Responsive layout with mobile-first design
 * - All functionality verified and working
 */

import React from 'react';
import { 
  Container, 
  Typography, 
  Box,
  Button,
  Card,
  CardContent,
  Stack
} from '@mui/material';
import { 
  AccountBalance as AccountBalanceIcon,
  Receipt as TransactionsIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

// Existing Dashboard components
import UncategorizedTransactionsWidget from '../components/dashboard/UncategorizedTransactionsWidget';

// New Overview components
import FinancialSummaryCards from '../components/overview/FinancialSummaryCards';
import ActionItemsList from '../components/overview/ActionItemsList';
import RecentActivityTimeline from '../components/overview/RecentActivityTimeline';

const Overview: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Container maxWidth="xl">
      <Box sx={{ mt: 4, mb: 4 }}>
        {/* Page Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" gutterBottom>
            Financial Overview
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Welcome to GeriFinancial! Your complete financial dashboard with smart insights and quick actions.
          </Typography>
        </Box>

        {/* Financial Summary Cards - Top Section */}
        <Box sx={{ mb: 4 }}>
          <FinancialSummaryCards />
        </Box>

        {/* Main Content Layout */}
        <Box sx={{ 
          display: 'flex',
          flexDirection: { xs: 'column', lg: 'row' },
          gap: 3
        }}>
          {/* Left Column - Action Items and Uncategorized Transactions */}
          <Box sx={{ 
            flex: { lg: '0 0 33%' },
            display: 'flex', 
            flexDirection: 'column', 
            gap: 3 
          }}>
            {/* Action Items */}
            <Box sx={{ flex: 1 }}>
              <ActionItemsList maxItems={5} />
            </Box>
            
            {/* Legacy Uncategorized Transactions Widget for compatibility */}
            <Box>
              <UncategorizedTransactionsWidget />
            </Box>
          </Box>

          {/* Center Column - Recent Activity Timeline */}
          <Box sx={{ flex: { lg: '0 0 42%' } }}>
            <RecentActivityTimeline maxDays={7} maxTransactionsPerDay={5} />
          </Box>

          {/* Right Column - Quick Actions */}
          <Box sx={{ flex: { lg: '0 0 25%' } }}>
            <Card sx={{ height: '100%', minHeight: 400 }}>
              <CardContent sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                height: '100%'
              }}>
                <Typography variant="h6" gutterBottom>
                  Quick Actions
                </Typography>
                
                <Stack spacing={2} sx={{ flex: 1, justifyContent: 'center' }}>
                  <Button
                    variant="contained"
                    startIcon={<TransactionsIcon />}
                    onClick={() => navigate('/transactions')}
                    fullWidth
                    size="large"
                  >
                    View All Transactions
                  </Button>
                  
                  <Button
                    variant="outlined"
                    startIcon={<AccountBalanceIcon />}
                    onClick={() => navigate('/transactions?tab=bank-management')}
                    fullWidth
                    size="large"
                  >
                    Manage Bank Accounts
                  </Button>
                  
                  <Button
                    variant="outlined"
                    startIcon={<TrendingUpIcon />}
                    onClick={() => navigate('/budgets')}
                    fullWidth
                    size="large"
                  >
                    View Budgets
                  </Button>
                </Stack>

                {/* Additional Stats or Info */}
                <Box sx={{ 
                  mt: 2, 
                  pt: 2, 
                  borderTop: 1, 
                  borderColor: 'divider',
                  textAlign: 'center'
                }}>
                  <Typography variant="caption" color="text.secondary">
                    Last updated: {new Date().toLocaleTimeString('he-IL', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Box>
        </Box>

        {/* Bottom Section - Optional Future Content */}
        <Box sx={{ mt: 4 }}>
          {/* Reserved space for future widgets like spending insights, budget alerts, etc. */}
        </Box>
      </Box>
    </Container>
  );
};

export default Overview;
