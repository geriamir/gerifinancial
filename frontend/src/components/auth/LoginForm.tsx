import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Typography, Box, Paper, Alert } from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import { githubLoginUrl } from '../../services/api';

const LoginForm: React.FC = () => {
  const [searchParams] = useSearchParams();
  // The callback appends this when the user declines authorisation on GitHub.
  const authError = searchParams.get('auth_error');

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh'
      }}
    >
      <Paper
        elevation={3}
        sx={{
          padding: 4,
          width: '100%',
          maxWidth: 400
        }}
      >
        <Typography variant="h5" component="h1" align="center" gutterBottom>
          Sign in to GeriFinancial
        </Typography>

        {authError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Sign-in was cancelled. Please try again.
          </Alert>
        )}

        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
          Your account is created automatically the first time you sign in.
        </Typography>

        <Button
          fullWidth
          variant="contained"
          size="large"
          startIcon={<GitHubIcon />}
          component="a"
          href={githubLoginUrl('/')}
          data-testid="github-login-button"
        >
          Continue with GitHub
        </Button>
      </Paper>
    </Box>
  );
};

export default LoginForm;
