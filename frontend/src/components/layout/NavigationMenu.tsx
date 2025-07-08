import React, { useState, useEffect } from 'react';
import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Badge
} from '@mui/material';
import {
  Home as HomeIcon,
  AccountBalance as AccountIcon,
  Receipt as TransactionsIcon,
  Category as CategoryIcon,
  Pending as PendingIcon
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { transactionsApi } from '../../services/api/transactions';
import type { ProcessingStats } from '../../services/api/types/transactions';

const REFRESH_INTERVAL = 30000; // 30 seconds

interface NavigationItem {
  title: string;
  path: string;
  icon: React.ReactElement;
  showBadge?: boolean;
}

const navigationItems: NavigationItem[] = [
  { title: 'Dashboard', path: '/', icon: <HomeIcon /> },
  { title: 'Bank Accounts', path: '/banks', icon: <AccountIcon /> },
  { title: 'Transactions', path: '/transactions', icon: <TransactionsIcon /> },
  { 
    title: 'Pending', 
    path: '/pending', 
    icon: <PendingIcon />, 
    showBadge: true 
  }
];

export const NavigationMenu: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [pendingVerifications, setPendingVerifications] = useState(0);

  useEffect(() => {
  const loadProcessingStats = async () => {
      try {
        const stats = await transactionsApi.getProcessingStats();
        setPendingVerifications(stats.pending);
      } catch (err) {
        console.error('Failed to load verification stats:', err);
      }
    };

    loadProcessingStats();
    const interval = setInterval(loadProcessingStats, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, []);

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
              {item.showBadge && pendingVerifications > 0 ? (
                <Badge badgeContent={pendingVerifications} color="error">
                  {item.icon}
                </Badge>
              ) : (
                item.icon
              )}
            </ListItemIcon>
            <ListItemText primary={item.title} />
          </ListItemButton>
        ))}
      </List>
    </Drawer>
  );
};
