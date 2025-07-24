/**
 * NAVIGATION SIMPLIFICATION - Completed
 * 
 * Implementation Notes:
 * - Action items component for enhanced Overview page
 * - Displays urgent tasks: uncategorized transactions, connection issues, budget alerts
 * - Clickable items with navigation to relevant pages
 * - Priority-based styling and icons
 * - TypeScript-safe color handling for Material-UI components
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Chip,
  Alert,
  Divider
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Receipt as TransactionsIcon,
  AccountBalance as BankIcon,
  TrendingUp as PatternIcon,
  AccountBalanceWallet as BudgetIcon,
  ArrowForward as ArrowIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface ActionItem {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  count?: number;
  action: {
    label: string;
    route: string;
    params?: Record<string, string>;
  };
  icon: React.ReactElement;
  priority: 'high' | 'medium' | 'low';
}

interface ActionItemsListProps {
  items?: ActionItem[];
  loading?: boolean;
  maxItems?: number;
}

// Default empty state when no action items are available
const emptyActionItems: ActionItem[] = [];

const getActionItemIcon = (type: string) => {
  switch (type) {
    case 'error': return <ErrorIcon sx={{ color: 'error.main' }} />;
    case 'warning': return <WarningIcon sx={{ color: 'warning.main' }} />;
    case 'info': return <InfoIcon sx={{ color: 'info.main' }} />;
    default: return <InfoIcon sx={{ color: 'text.secondary' }} />;
  }
};

// Type-safe color mapping for Material-UI Chip component
type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

const getActionItemColor = (type: string): ChipColor => {
  switch (type) {
    case 'error': return 'error';
    case 'warning': return 'warning';
    case 'info': return 'info';
    default: return 'default';
  }
};

const getPriorityOrder = (priority: string) => {
  switch (priority) {
    case 'high': return 1;
    case 'medium': return 2;
    case 'low': return 3;
    default: return 4;
  }
};

export const ActionItemsList: React.FC<ActionItemsListProps> = ({
  items = [],
  loading = false,
  maxItems = 5
}) => {
  const navigate = useNavigate();

  const handleActionClick = (actionItem: ActionItem) => {
    const { route, params } = actionItem.action;
    const searchParams = new URLSearchParams(params);
    const finalRoute = params && Object.keys(params).length > 0 
      ? `${route}?${searchParams.toString()}`
      : route;
    
    navigate(finalRoute);
  };

  // Sort by priority and limit items
  const sortedItems = items
    .sort((a, b) => getPriorityOrder(a.priority) - getPriorityOrder(b.priority))
    .slice(0, maxItems);

  if (loading) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Action Items
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[1, 2, 3].map((index) => (
              <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ width: 24, height: 24, bgcolor: 'grey.300', borderRadius: '50%' }} />
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ width: '70%', height: 16, bgcolor: 'grey.300', borderRadius: 1, mb: 0.5 }} />
                  <Box sx={{ width: '90%', height: 12, bgcolor: 'grey.300', borderRadius: 1 }} />
                </Box>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (sortedItems.length === 0) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          textAlign: 'center',
          minHeight: 200
        }}>
          <InfoIcon sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
          <Typography variant="h6" color="success.main" gutterBottom>
            All caught up!
          </Typography>
          <Typography variant="body2" color="text.secondary">
            No urgent action items at the moment. Great job staying on top of your finances!
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">
            Action Items
          </Typography>
          <Chip 
            label={`${sortedItems.length} item${sortedItems.length !== 1 ? 's' : ''}`}
            size="small"
            color={sortedItems.some(item => item.type === 'error') ? 'error' : 'warning'}
          />
        </Box>

        <List sx={{ p: 0 }}>
          {sortedItems.map((item, index) => (
            <Box key={item.id}>
              <ListItem sx={{ p: 0 }}>
                <ListItemButton
                  onClick={() => handleActionClick(item)}
                  sx={{
                    borderRadius: 1,
                    mb: 1,
                    '&:hover': {
                      backgroundColor: `${getActionItemColor(item.type)}.50`
                    }
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    {getActionItemIcon(item.type)}
                  </ListItemIcon>
                  
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          {item.title}
                        </Typography>
                        {item.count && (
                          <Chip 
                            label={item.count}
                            size="small"
                            color={getActionItemColor(item.type)}
                            sx={{ height: 20, fontSize: '0.75rem' }}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {item.description}
                      </Typography>
                    }
                  />
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 1 }}>
                    <Typography variant="caption" color="primary.main" sx={{ fontWeight: 500 }}>
                      {item.action.label}
                    </Typography>
                    <ArrowIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                  </Box>
                </ListItemButton>
              </ListItem>
              
              {index < sortedItems.length - 1 && (
                <Divider sx={{ my: 0.5, mx: 2 }} />
              )}
            </Box>
          ))}
        </List>

        {items.length > maxItems && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Showing {maxItems} of {items.length} action items. 
              Visit individual pages to see all items.
            </Typography>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default ActionItemsList;
