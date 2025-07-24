/**
 * NAVIGATION SIMPLIFICATION - Completed
 * 
 * Implementation Notes:
 * - Recent activity timeline component for enhanced Overview page
 * - Now uses the existing TransactionsList component for consistency
 * - Provides date range filters for last 7 days of transactions
 * - Includes proper header, loading states, and navigation actions
 * - Eliminates code duplication with proper component reuse
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button
} from '@mui/material';
import {
  ArrowForward as ArrowIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import TransactionsList from '../transactions/TransactionsList';
import type { Transaction } from '../../services/api/types/transactions';

interface RecentActivityTimelineProps {
  maxDays?: number;
  onTransactionClick?: (transaction: Transaction) => void;
}

export const RecentActivityTimeline: React.FC<RecentActivityTimelineProps> = ({
  maxDays = 7,
  onTransactionClick
}) => {
  const navigate = useNavigate();
  
  const handleViewAllTransactions = () => {
    navigate('/transactions');
  };

  const handleTransactionClick = (transaction: Transaction) => {
    if (onTransactionClick) {
      onTransactionClick(transaction);
    } else {
      // Default action - navigate to transactions with detail view
      navigate(`/transactions?transaction=${transaction._id}&action=view`);
    }
  };

  // Calculate date range for recent transactions
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - maxDays);

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ pb: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">
            Recent Activity
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Last {maxDays} days
          </Typography>
        </Box>
        
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <TransactionsList
            filters={{
              startDate,
              endDate
            }}
            onRowClick={handleTransactionClick}
          />
        </Box>
        
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          mt: 2, 
          pt: 1, 
          borderTop: 1, 
          borderColor: 'divider' 
        }}>
          <Button
            variant="text"
            endIcon={<ArrowIcon />}
            onClick={handleViewAllTransactions}
            size="small"
          >
            View All Transactions
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default RecentActivityTimeline;
