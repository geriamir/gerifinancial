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
  AccountBalance as AccountIcon,
  Receipt as TransactionsIcon
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';

interface NavigationItem {
  title: string;
  path: string;
  icon: React.ReactElement;
}

const navigationItems: NavigationItem[] = [
  { title: 'Dashboard', path: '/', icon: <HomeIcon /> },
  { title: 'Bank Accounts', path: '/banks', icon: <AccountIcon /> },
  { title: 'Transactions', path: '/transactions', icon: <TransactionsIcon /> }
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
