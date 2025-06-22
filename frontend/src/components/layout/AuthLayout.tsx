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
  Avatar
} from '@mui/material';
import { AccountCircle as AccountCircleIcon } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

const AuthLayout: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

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
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            GeriFinancial
          </Typography>

          <Box>
            <IconButton
              size="large"
              onClick={handleMenu}
              color="inherit"
            >
              {user?.name ? (
                <Avatar sx={{ bgcolor: 'secondary.main' }}>
                  {user.name.charAt(0).toUpperCase()}
                </Avatar>
              ) : (
                <AccountCircleIcon />
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

      <Container component="main" sx={{ flex: 1, py: 4 }}>
        <Outlet />
      </Container>

      <Box
        component="footer"
        sx={{
          py: 3,
          px: 2,
          mt: 'auto',
          backgroundColor: (theme) =>
            theme.palette.mode === 'light'
              ? theme.palette.grey[200]
              : theme.palette.grey[800],
        }}
      >
        <Container maxWidth="sm">
          <Typography variant="body2" color="text.secondary" align="center">
            © {new Date().getFullYear()} GeriFinancial. All rights reserved.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
};

export default AuthLayout;
