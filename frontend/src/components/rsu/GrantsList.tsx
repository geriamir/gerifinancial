import React, { useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  LinearProgress,
  Skeleton,
  Button,
  Tooltip
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Schedule as ScheduleIcon,
  SellOutlined as SellIcon,
  EditOutlined as EditIcon,
  DeleteOutline as DeleteIcon,
  InfoOutlined as InfoIcon,
  PriceChange as PriceChangeIcon
} from '@mui/icons-material';
import { RSUGrant } from '../../services/api/rsus';
import { useRSU } from '../../contexts/RSUContext';
import RecordSaleForm from './RecordSaleForm';
import StockPriceUpdater from './StockPriceUpdater';

interface GrantsListProps {
  grants: RSUGrant[];
  loading?: boolean;
  onGrantSelect?: (grant: RSUGrant) => void;
  onEditGrant?: (grant: RSUGrant) => void;
  onDeleteGrant?: (grant: RSUGrant) => void;
  onRecordSale?: (grant: RSUGrant) => void;
}

interface GrantItemProps {
  grant: RSUGrant;
  onEdit?: (grant: RSUGrant) => void;
  onDelete?: (grant: RSUGrant) => void;
  onRecordSale?: (grant: RSUGrant) => void;
  onViewDetails?: (grant: RSUGrant) => void;
}

const GrantItem: React.FC<GrantItemProps> = ({
  grant,
  onEdit,
  onDelete,
  onRecordSale,
  onViewDetails
}) => {
  const { getSalesByGrant, sales, salesLoading } = useRSU();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [priceUpdaterOpen, setPriceUpdaterOpen] = useState(false);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleEdit = () => {
    handleClose();
    onEdit?.(grant);
  };

  const handleDelete = () => {
    handleClose();
    onDelete?.(grant);
  };

  const handleRecordSale = () => {
    handleClose();
    onRecordSale?.(grant);
  };

  const handleViewDetails = () => {
    handleClose();
    onViewDetails?.(grant);
  };

  const handleUpdatePrice = () => {
    handleClose();
    setPriceUpdaterOpen(true);
  };

  const handleClosePriceUpdater = () => {
    setPriceUpdaterOpen(false);
  };

  const handlePriceUpdate = (newPrice: number) => {
    // TODO: Implement actual price update via API
    console.log(`Update price for ${grant.stockSymbol} to $${newPrice}`);
  };

  const isPositiveGainLoss = grant.gainLoss >= 0;
  const vestingProgress = Math.round(grant.vestingProgress);
  
  // Calculate available shares (vested shares minus sold shares) - memoized for performance
  const { directFilteredSales, sharesSold, availableShares } = useMemo(() => {
    // Handle both string grantId and populated grant object
    const filteredSales = sales.filter(sale => {
      const saleGrantId = typeof sale.grantId === 'string' ? sale.grantId : (sale.grantId as any)?._id;
      return saleGrantId === grant._id;
    }) || [];
    
    const soldShares = filteredSales.reduce((total, sale) => total + sale.sharesAmount, 0);
    const available = Math.max(0, grant.vestedShares - soldShares);
    
    return {
      directFilteredSales: filteredSales,
      sharesSold: soldShares,
      availableShares: available
    };
  }, [sales, grant._id, grant.vestedShares]);
  
  // Debug logging
  console.log(`Grant ${grant.stockSymbol} (${grant._id}):`, {
    totalShares: grant.totalShares,
    vestedShares: grant.vestedShares,
    directFilteredSales: directFilteredSales.length,
    sharesSold,
    availableShares,
    salesLoading,
    allSales: sales.length,
    sampleSale: sales.length > 0 ? { 
      grantId: sales[0].grantId, 
      grantIdType: typeof sales[0].grantId,
      sharesAmount: sales[0].sharesAmount 
    } : null
  });
  
  // Format dates
  const grantDateFormatted = new Date(grant.grantDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  // Calculate next vesting date
  const nextVestingEvent = grant.vestingSchedule?.find(event => !event.vested);
  const nextVestingDate = nextVestingEvent 
    ? new Date(nextVestingEvent.vestDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    : null;

  return (
    <Card variant="outlined" sx={{ mb: 2, position: 'relative' }}>
      <CardContent>
        {/* Header Row */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="h6" component="h3">
                {grant.stockSymbol}
                {grant.name && ` • ${grant.name}`}
              </Typography>
              <Chip
                size="small"
                label={grant.status}
                color={grant.status === 'active' ? 'success' : 'default'}
                variant="outlined"
              />
            </Box>
            {grant.company && (
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {grant.company}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary">
              Granted: {grantDateFormatted}
            </Typography>
          </Box>

          <IconButton
            aria-label="more"
            onClick={handleClick}
            size="small"
          >
            <MoreVertIcon />
          </IconButton>

          <Menu
            anchorEl={anchorEl}
            open={open}
            onClose={handleClose}
            onClick={handleClose}
          >
            <MenuItem onClick={handleViewDetails}>
              <InfoIcon sx={{ mr: 1 }} />
              View Details
            </MenuItem>
            <MenuItem onClick={handleRecordSale}>
              <SellIcon sx={{ mr: 1 }} />
              Record Sale
            </MenuItem>
            <MenuItem onClick={handleUpdatePrice}>
              <PriceChangeIcon sx={{ mr: 1 }} />
              Update Price
            </MenuItem>
            <MenuItem onClick={handleEdit}>
              <EditIcon sx={{ mr: 1 }} />
              Edit Grant
            </MenuItem>
            <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
              <DeleteIcon sx={{ mr: 1 }} />
              Delete Grant
            </MenuItem>
          </Menu>
        </Box>

        {/* Main Metrics Grid */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { 
            xs: 'repeat(2, 1fr)', 
            sm: 'repeat(3, 1fr)', 
            md: 'repeat(5, 1fr)' 
          },
          gap: 2,
          mb: 2
        }}>
          {/* Total Shares */}
          <Box>
            <Typography variant="body2" color="text.secondary">
              Total Shares
            </Typography>
            <Typography variant="h6">
              {grant.totalShares.toLocaleString()}
            </Typography>
          </Box>

          {/* Current Value */}
          <Box>
            <Typography variant="body2" color="text.secondary">
              Current Value
            </Typography>
            <Typography variant="h6" color="primary">
              ${grant.currentValue.toLocaleString()}
            </Typography>
          </Box>

          {/* Gain/Loss */}
          <Box>
            <Typography variant="body2" color="text.secondary">
              Gain/Loss
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {isPositiveGainLoss ? (
                <TrendingUpIcon fontSize="small" color="success" />
              ) : (
                <TrendingDownIcon fontSize="small" color="error" />
              )}
              <Typography 
                variant="h6" 
                color={isPositiveGainLoss ? 'success.main' : 'error.main'}
              >
                {isPositiveGainLoss ? '+' : ''}${grant.gainLoss.toLocaleString()}
              </Typography>
            </Box>
            <Typography 
              variant="caption" 
              color={isPositiveGainLoss ? 'success.main' : 'error.main'}
            >
              ({isPositiveGainLoss ? '+' : ''}{grant.gainLossPercentage.toFixed(1)}%)
            </Typography>
          </Box>

          {/* Current Price */}
          <Box>
            <Typography variant="body2" color="text.secondary">
              Current Price
            </Typography>
            <Typography variant="h6">
              ${grant.currentPrice.toFixed(2)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              vs ${grant.pricePerShare.toFixed(2)} grant
            </Typography>
          </Box>

          {/* Vesting Progress */}
          <Box>
            <Typography variant="body2" color="text.secondary">
              Vested
            </Typography>
            <Typography variant="h6" color="info.main">
              {vestingProgress}%
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={vestingProgress} 
              sx={{ mt: 0.5, height: 4, borderRadius: 2 }}
            />
          </Box>
        </Box>

        {/* Vesting Information */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          gap: 2,
          pt: 2,
          borderTop: 1,
          borderColor: 'divider'
        }}>
          <Box>
            <Typography variant="body2" color="text.secondary">
              Vested / Unvested Shares
            </Typography>
            <Typography variant="body1">
              <span style={{ color: 'green' }}>{grant.vestedShares.toLocaleString()}</span>
              {' / '}
              <span style={{ color: 'orange' }}>{grant.unvestedShares.toLocaleString()}</span>
            </Typography>
          </Box>

          <Box>
            <Typography variant="body2" color="text.secondary">
              Available Shares
            </Typography>
            <Typography variant="body1" color="secondary.main">
              {availableShares.toLocaleString()}
              {sharesSold > 0 && (
                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  ({sharesSold.toLocaleString()} sold)
                </Typography>
              )}
            </Typography>
          </Box>

          {nextVestingDate && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ScheduleIcon fontSize="small" color="primary" />
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Next Vesting
                </Typography>
                <Typography variant="body1">
                  {nextVestingDate}
                </Typography>
                {nextVestingEvent && (
                  <Typography variant="caption" color="text.secondary">
                    {nextVestingEvent.shares.toLocaleString()} shares
                  </Typography>
                )}
              </Box>
            </Box>
          )}
        </Box>

        {/* Notes */}
        {grant.notes && (
          <Box sx={{ mt: 2, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Notes: {grant.notes}
            </Typography>
          </Box>
        )}
      </CardContent>

      {/* Stock Price Updater */}
      <StockPriceUpdater
        open={priceUpdaterOpen}
        onClose={handleClosePriceUpdater}
        grant={grant}
        onPriceUpdate={handlePriceUpdate}
      />
    </Card>
  );
};

const GrantsList: React.FC<GrantsListProps> = ({
  grants,
  loading = false,
  onGrantSelect,
  onEditGrant,
  onDeleteGrant,
  onRecordSale
}) => {
  if (loading) {
    return (
      <Box>
        {[1, 2, 3].map((item) => (
          <Card key={item} variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" width="30%" height={28} />
                  <Skeleton variant="text" width="60%" height={20} />
                  <Skeleton variant="text" width="40%" height={16} />
                </Box>
                <Skeleton variant="circular" width={32} height={32} />
              </Box>
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: 2
              }}>
                {[1, 2, 3, 4, 5].map((metric) => (
                  <Box key={metric}>
                    <Skeleton variant="text" width="80%" height={16} />
                    <Skeleton variant="text" width="60%" height={24} />
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  }

  if (grants.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No RSU Grants Found
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Add your first RSU grant to start tracking your equity portfolio
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {grants.map((grant) => (
        <GrantItem
          key={grant._id}
          grant={grant}
          onEdit={onEditGrant}
          onDelete={onDeleteGrant}
          onRecordSale={onRecordSale}
          onViewDetails={onGrantSelect}
        />
      ))}
    </Box>
  );
};

export default GrantsList;
