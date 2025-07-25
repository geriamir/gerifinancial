import React, { useState, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  useTheme,
  Alert,
  CircularProgress,
  Backdrop
} from '@mui/material';
import {
  Add as AddIcon,
  SellOutlined as SellIcon,
  TrendingUp as TrendingUpIcon,
  Schedule as ScheduleIcon,
  AccountBalance as AccountBalanceIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';
import { useRSU } from '../contexts/RSUContext';
import RSUPortfolioCard from '../components/rsu/RSUPortfolioCard';
import GrantsList from '../components/rsu/GrantsList';
import UpcomingVestingWidget from '../components/rsu/UpcomingVestingWidget';
import RecentSalesWidget from '../components/rsu/RecentSalesWidget';
import AddGrantWizard from '../components/rsu/AddGrantWizard';
import RecordSaleForm from '../components/rsu/RecordSaleForm';
import { RSUGrant } from '../services/api/rsus';

const RSUs: React.FC = () => {
  const theme = useTheme();
  
  const {
    portfolioSummary,
    grants,
    upcomingVesting,
    loading,
    portfolioLoading,
    grantsLoading,
    error,
    clearError
  } = useRSU();

  const [addGrantOpen, setAddGrantOpen] = useState(false);
  const [recordSaleOpen, setRecordSaleOpen] = useState(false);
  const [selectedGrantForSale, setSelectedGrantForSale] = useState<RSUGrant | null>(null);

  const handleAddGrant = useCallback(() => {
    setAddGrantOpen(true);
  }, []);

  const handleCloseAddGrant = useCallback(() => {
    setAddGrantOpen(false);
  }, []);

  const handleRecordSale = useCallback((grant: RSUGrant) => {
    setSelectedGrantForSale(grant);
    setRecordSaleOpen(true);
  }, []);

  const handleGlobalRecordSale = useCallback(() => {
    setRecordSaleOpen(true);
    // Don't pre-select a grant - let user choose in the form
    setSelectedGrantForSale(null);
  }, []);

  const handleCloseRecordSale = useCallback(() => {
    setRecordSaleOpen(false);
    setSelectedGrantForSale(null);
  }, []);

  const handleEditGrant = useCallback((grant: RSUGrant) => {
    // TODO: Implement edit grant functionality
    console.log('Edit grant:', grant);
  }, []);

  const handleDeleteGrant = useCallback((grant: RSUGrant) => {
    // TODO: Implement delete grant functionality
    console.log('Delete grant:', grant);
  }, []);

  const handleViewGrantDetails = useCallback((grant: RSUGrant) => {
    // TODO: Implement view grant details functionality
    console.log('View grant details:', grant);
  }, []);

  // Show loading backdrop on initial load
  if (loading) {
    return (
      <Backdrop open={true} sx={{ color: '#fff', zIndex: theme.zIndex.drawer + 1 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <CircularProgress color="inherit" />
          <Typography variant="h6">Loading RSU Portfolio...</Typography>
        </Box>
      </Backdrop>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          RSU Portfolio
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your Restricted Stock Units, track vesting schedules, and optimize tax planning
        </Typography>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert 
          severity="error" 
          onClose={clearError}
          sx={{ mb: 3 }}
        >
          {error}
        </Alert>
      )}

      {/* Main Content */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Portfolio Overview */}
        <RSUPortfolioCard 
          portfolioSummary={portfolioSummary}
          loading={portfolioLoading}
        />


        {/* Main Content Layout */}
        <Box sx={{ 
          display: 'flex',
          flexDirection: { xs: 'column', lg: 'row' },
          gap: 3
        }}>
          {/* Left Column - Grants List */}
          <Box sx={{ flex: { lg: '0 0 65%' } }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" component="h2">
                    My RSU Grants
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="outlined"
                      startIcon={<SellIcon />}
                      onClick={handleGlobalRecordSale}
                      size="small"
                      disabled={grants.length === 0}
                    >
                      Record Sale
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={handleAddGrant}
                      size="small"
                    >
                      Add Grant
                    </Button>
                  </Box>
                </Box>
                <GrantsList 
                  grants={grants}
                  loading={grantsLoading}
                  onGrantSelect={handleViewGrantDetails}
                  onEditGrant={handleEditGrant}
                  onDeleteGrant={handleDeleteGrant}
                  onRecordSale={handleRecordSale}
                />
              </CardContent>
            </Card>
          </Box>

          {/* Right Column - Widgets */}
          <Box sx={{ flex: { lg: '0 0 35%' }, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Upcoming Vesting Events */}
            <Card>
              <CardContent>
                <Typography variant="h6" component="h2" gutterBottom>
                  Upcoming Vesting
                </Typography>
                <UpcomingVestingWidget 
                  events={upcomingVesting}
                  loading={loading}
                />
              </CardContent>
            </Card>

            {/* Recent Sales */}
            <Card>
              <CardContent>
                <Typography variant="h6" component="h2" gutterBottom>
                  Recent Sales
                </Typography>
                <RecentSalesWidget />
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Box>

      {/* Add Grant Wizard */}
      <AddGrantWizard
        open={addGrantOpen}
        onClose={handleCloseAddGrant}
      />

      {/* Record Sale Form */}
      <RecordSaleForm
        open={recordSaleOpen}
        onClose={handleCloseRecordSale}
        grant={selectedGrantForSale}
      />
    </Container>
  );
};

export default RSUs;
