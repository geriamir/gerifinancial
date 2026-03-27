import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Container,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Drawer,
  Divider
} from '@mui/material';
import {
  AccountCircle as AccountCircleIcon,
  Menu as MenuIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon
} from '@mui/icons-material';
import { NavigationMenu } from './NavigationMenu';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeMode } from '../../contexts/ThemeContext';

const AuthLayout: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { mode, toggleTheme } = useThemeMode();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleClose();
    logout();
    navigate('/login');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            aria-label="menu"
            onClick={() => setDrawerOpen(true)}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 700, letterSpacing: '-0.01em' }}>
            GeriFinancial
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton
              color="inherit"
              onClick={toggleTheme}
              aria-label="toggle dark mode"
              sx={{
                transition: 'transform 0.3s ease',
                '&:hover': { transform: 'rotate(30deg)' },
              }}
            >
              {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
            <IconButton
              size="large"
              onClick={handleMenu}
              color="inherit"
            >
              {user?.name ? (
                <Avatar sx={{ bgcolor: 'secondary.main' }} data-testid="user-avatar">
                  {user.name.charAt(0).toUpperCase()}
                </Avatar>
              ) : (
                <AccountCircleIcon data-testid="user-avatar" />
              )}
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              open={Boolean(anchorEl)}
              onClose={handleClose}
            >
              <MenuItem onClick={() => {
                handleClose();
                navigate('/profile');
              }}>
                Profile
              </MenuItem>
              <MenuItem onClick={handleLogout}>Logout</MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <Box
          sx={{
            width: 250,
            pt: 2,
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
          }}
          role="presentation"
          onClick={() => setDrawerOpen(false)}
        >
          <Typography
            variant="h6"
            component="div"
            sx={{ px: 2, py: 1, fontWeight: 700, letterSpacing: '-0.01em' }}
          >
            GeriFinancial
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <NavigationMenu />
        </Box>
      </Drawer>

      <Container component="main" sx={{ flex: 1, py: 4 }}>
        <Outlet />
      </Container>

      <Box
        component="footer"
        sx={{
          py: 2,
          px: 2,
          mt: 'auto',
          borderTop: 1,
          borderColor: 'divider',
          backgroundColor: 'background.paper',
        }}
      >
        <Container maxWidth="sm">
          <Typography variant="caption" color="text.secondary" align="center" display="block">
            © {new Date().getFullYear()} GeriFinancial
          </Typography>
        </Container>
      </Box>
    </Box>
  );
};

export default AuthLayout;
