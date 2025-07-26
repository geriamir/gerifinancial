import React, { useState, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
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
  SellOutlined as SellIcon
} from '@mui/icons-material';
import { useRSU } from '../contexts/RSUContext';
import RSUPortfolioCard from '../components/rsu/RSUPortfolioCard';
import RSUVestingChart from '../components/rsu/RSUVestingChart';
import GrantsList from '../components/rsu/GrantsList';
import UpcomingVestingWidget from '../components/rsu/UpcomingVestingWidget';
import RecentSalesWidget from '../components/rsu/RecentSalesWidget';
import AddGrantWizard from '../components/rsu/AddGrantWizard';
import RecordSaleForm from '../components/rsu/RecordSaleForm';
import EditGrantDialog from '../components/rsu/EditGrantDialog';
import DeleteGrantConfirmDialog from '../components/rsu/DeleteGrantConfirmDialog';
import GrantDetailsDialog from '../components/rsu/GrantDetailsDialog';
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
  const [editGrantOpen, setEditGrantOpen] = useState(false);
  const [deleteGrantOpen, setDeleteGrantOpen] = useState(false);
  const [grantDetailsOpen, setGrantDetailsOpen] = useState(false);
  const [selectedGrantForSale, setSelectedGrantForSale] = useState<RSUGrant | null>(null);
  const [selectedGrantForEdit, setSelectedGrantForEdit] = useState<RSUGrant | null>(null);
  const [selectedGrantForDelete, setSelectedGrantForDelete] = useState<RSUGrant | null>(null);
  const [selectedGrantForDetails, setSelectedGrantForDetails] = useState<RSUGrant | null>(null);

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
    setSelectedGrantForEdit(grant);
    setEditGrantOpen(true);
  }, []);

  const handleCloseEditGrant = useCallback(() => {
    setEditGrantOpen(false);
    setSelectedGrantForEdit(null);
  }, []);

  const handleDeleteGrant = useCallback((grant: RSUGrant) => {
    setSelectedGrantForDelete(grant);
    setDeleteGrantOpen(true);
  }, []);

  const handleCloseDeleteGrant = useCallback(() => {
    setDeleteGrantOpen(false);
    setSelectedGrantForDelete(null);
  }, []);

  const handleViewGrantDetails = useCallback((grant: RSUGrant) => {
    setSelectedGrantForDetails(grant);
    setGrantDetailsOpen(true);
  }, []);

  const handleCloseGrantDetails = useCallback(() => {
    setGrantDetailsOpen(false);
    setSelectedGrantForDetails(null);
  }, []);

  // Handle edit from grant details dialog
  const handleEditFromDetails = useCallback((grant: RSUGrant) => {
    setSelectedGrantForEdit(grant);
    setEditGrantOpen(true);
  }, []);

  // Handle delete from grant details dialog
  const handleDeleteFromDetails = useCallback((grant: RSUGrant) => {
    setSelectedGrantForDelete(grant);
    setDeleteGrantOpen(true);
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
        {/* Primary Visualization - Vesting Timeline Chart */}
        <RSUVestingChart height={500} />

        {/* Portfolio Summary (Compact) */}
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
                  grants={(() => {
                    console.log('GrantsList receiving grants:', grants.length, 'grants, loading:', grantsLoading);
                    return grants;
                  })()}
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

      {/* Edit Grant Dialog */}
      <EditGrantDialog
        open={editGrantOpen}
        grant={selectedGrantForEdit}
        onClose={handleCloseEditGrant}
      />

      {/* Delete Grant Confirmation Dialog */}
      <DeleteGrantConfirmDialog
        open={deleteGrantOpen}
        grant={selectedGrantForDelete}
        onClose={handleCloseDeleteGrant}
      />

      {/* Grant Details Dialog */}
      <GrantDetailsDialog
        open={grantDetailsOpen}
        grant={selectedGrantForDetails}
        onClose={handleCloseGrantDetails}
        onEdit={handleEditFromDetails}
        onDelete={handleDeleteFromDetails}
      />
    </Container>
  );
};

export default RSUs;
