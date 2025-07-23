/**
 * NAVIGATION SIMPLIFICATION - Component Status
 * 
 * Status: ⏳ IN PROGRESS
 * Phase: 1
 * Last Updated: July 23, 2025
 * 
 * Implementation Notes:
 * - Updated from 4 to 3 navigation items
 * - Removed "Bank Accounts" - will be integrated into Transactions page
 * - Changed "Dashboard" to "Overview" for enhanced functionality
 * - Maintained existing drawer navigation structure
 * - Testing status: Pending
 */

import React from 'react';
import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Home as HomeIcon,
  Receipt as TransactionsIcon,
  AccountBalanceWallet as BudgetIcon
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';

interface NavigationItem {
  title: string;
  path: string;
  icon: React.ReactElement;
}

const navigationItems: NavigationItem[] = [
  { title: 'Overview', path: '/', icon: <HomeIcon /> },
  { title: 'Transactions', path: '/transactions', icon: <TransactionsIcon /> },
  { title: 'Budgets', path: '/budgets', icon: <BudgetIcon /> }
];

export const NavigationMenu: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: 240,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: 240,
          boxSizing: 'border-box',
          backgroundColor: 'background.paper',
          borderRight: '1px solid',
          borderColor: 'divider'
        }
      }}
    >
      <List sx={{ mt: 8 }}>
        {navigationItems.map((item) => (
          <ListItemButton
            key={item.path}
            selected={location.pathname === item.path}
            onClick={() => handleNavigation(item.path)}
          >
            <ListItemIcon>
              {item.icon}
            </ListItemIcon>
            <ListItemText primary={item.title} />
          </ListItemButton>
        ))}
      </List>
    </Drawer>
  );
};
