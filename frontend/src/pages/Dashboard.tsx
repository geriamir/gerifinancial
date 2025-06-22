import React from 'react';
import { Container, Typography, Button, Stack } from '@mui/material';
import { AccountBalance as AccountBalanceIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Container>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      <Typography paragraph>
        Welcome to GeriFinancial! Start by connecting your bank accounts to view your financial data.
      </Typography>
      
      <Stack direction="row" spacing={2} mt={4}>
        <Button
          variant="contained"
          startIcon={<AccountBalanceIcon />}
          onClick={() => navigate('/banks')}
        >
          Manage Bank Accounts
        </Button>
      </Stack>
    </Container>
  );
};

export default Dashboard;
