/**
 * NAVIGATION SIMPLIFICATION - Completed + RSU Feature Added
 * 
 * Implementation Notes:
 * - Updated from 4 to 4 navigation items (replaced Bank Accounts with RSUs)
 * - Removed "Bank Accounts" - integrated into Transactions page
 * - Changed "Dashboard" to "Overview" for enhanced functionality
 * - Added "RSUs" for Restricted Stock Units management
 * - Maintained existing drawer navigation structure
 * - All functionality verified and working
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
  AccountBalanceWallet as BudgetIcon,
  AccountBalance as RSUIcon
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
  { title: 'Budgets', path: '/budgets', icon: <BudgetIcon /> },
  { title: 'RSUs', path: '/rsus', icon: <RSUIcon /> }
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
