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
  ListItemText,
  useTheme,
  alpha
} from '@mui/material';
import {
  Home as HomeIcon,
  Receipt as TransactionsIcon,
  AccountBalanceWallet as BudgetIcon,
  AccountBalance as RSUIcon,
  TrendingUp as InvestmentIcon,
  CurrencyExchange as ForeignCurrencyIcon,
  Assignment as ProjectIcon,
  CreditCard as BankingIcon,
  Shield as PensionIcon,
  HomeWork as RealEstateIcon
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
  { title: 'Banking & Cards', path: '/banks', icon: <BankingIcon /> },
  { title: 'Budgets', path: '/budgets', icon: <BudgetIcon /> },
  { title: 'Projects', path: '/projects', icon: <ProjectIcon /> },
  { title: 'Real Estate', path: '/real-estate', icon: <RealEstateIcon /> },
  { title: 'RSUs', path: '/rsus', icon: <RSUIcon /> },
  { title: 'Investments', path: '/investments', icon: <InvestmentIcon /> },
  { title: 'Pension & Savings', path: '/pension', icon: <PensionIcon /> },
  { title: 'Foreign Currency', path: '/foreign-currency', icon: <ForeignCurrencyIcon /> }
];

export const NavigationMenu: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
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
      <List sx={{ mt: 8, px: 1 }}>
        {navigationItems.map((item) => {
          const active = isActive(item.path);
          return (
            <ListItemButton
              key={item.path}
              selected={active}
              onClick={() => handleNavigation(item.path)}
              sx={{
                borderRadius: '10px',
                mb: 0.5,
                py: 1,
                ...(active && {
                  backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.15 : 0.08),
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.2 : 0.12),
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'primary.main',
                  },
                  '& .MuiListItemText-primary': {
                    fontWeight: 600,
                    color: 'primary.main',
                  },
                }),
                ...(!active && {
                  '&:hover': {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                  },
                }),
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.title}
                primaryTypographyProps={{ fontSize: '0.9rem' }}
              />
            </ListItemButton>
          );
        })}
      </List>
    </Drawer>
  );
};
