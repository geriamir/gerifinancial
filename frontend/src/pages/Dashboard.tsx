import React from 'react';
import { 
  Container, 
  Typography, 
  Button, 
  Stack, 
  Box,
  Card,
  CardContent
} from '@mui/material';
import { 
  AccountBalance as AccountBalanceIcon,
  Receipt as TransactionsIcon 
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import UncategorizedTransactionsWidget from '../components/dashboard/UncategorizedTransactionsWidget';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Welcome to GeriFinancial! Your financial overview and quick actions.
        </Typography>
        
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', md: 'row' }, 
          gap: 3, 
          mt: 3 
        }}>
          {/* Uncategorized Transactions Widget */}
          <Box sx={{ flex: 1, maxWidth: { md: 400 } }}>
            <UncategorizedTransactionsWidget />
          </Box>
          
          {/* Quick Actions Card */}
          <Box sx={{ flex: 1, maxWidth: { md: 400 } }}>
            <Card sx={{ height: '100%', minHeight: 200 }}>
              <CardContent sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                height: '100%'
              }}>
                <Typography variant="h6" gutterBottom>
                  Quick Actions
                </Typography>
                <Stack spacing={2} sx={{ flex: 1, justifyContent: 'center' }}>
                  <Button
                    variant="contained"
                    startIcon={<AccountBalanceIcon />}
                    onClick={() => navigate('/banks')}
                    fullWidth
                    size="large"
                  >
                    Manage Bank Accounts
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<TransactionsIcon />}
                    onClick={() => navigate('/transactions')}
                    fullWidth
                    size="large"
                  >
                    View All Transactions
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Box>
    </Container>
  );
};

export default Dashboard;
