import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tabs,
  Tab,
  Card,
  CardContent
} from '@mui/material';
import {
  Close as CloseIcon,
  InfoOutlined as InfoIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Schedule as ScheduleIcon,
  AttachMoney as AttachMoneyIcon,
  Assessment as AssessmentIcon,
  EventNote as EventNoteIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { RSUGrant } from '../../services/api/rsus';
import { useRSU } from '../../contexts/RSUContext';

interface GrantDetailsDialogProps {
  open: boolean;
  grant: RSUGrant | null;
  onClose: () => void;
  onEdit?: (grant: RSUGrant) => void;
  onDelete?: (grant: RSUGrant) => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`grant-details-tabpanel-${index}`}
      aria-labelledby={`grant-details-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
};

const GrantDetailsDialog: React.FC<GrantDetailsDialogProps> = ({
  open,
  grant,
  onClose,
  onEdit,
  onDelete
}) => {
  const { sales } = useRSU();
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleEdit = () => {
    if (grant && onEdit) {
      onEdit(grant);
      onClose();
    }
  };

  const handleDelete = () => {
    if (grant && onDelete) {
      onDelete(grant);
      onClose();
    }
  };

  // Calculate grant-related data
  const grantData = useMemo(() => {
    if (!grant) return null;

    // Filter sales for this grant
    const grantSales = sales.filter(sale => {
      const saleGrantId = typeof sale.grantId === 'string' ? sale.grantId : (sale.grantId as any)?._id;
      return saleGrantId === grant._id;
    });

    const totalSoldShares = grantSales.reduce((total, sale) => total + sale.sharesAmount, 0);
    const totalSaleValue = grantSales.reduce((total, sale) => total + sale.totalSaleValue, 0);
    const totalTaxPaid = grantSales.reduce((total, sale) => total + sale.taxCalculation.totalTax, 0);
    const totalNetProceeds = grantSales.reduce((total, sale) => total + sale.taxCalculation.netValue, 0);

    // Calculate vesting progress and timeline
    const totalVestingPeriods = grant.vestingSchedule?.length || 0;
    const vestedPeriods = grant.vestingSchedule?.filter(period => period.vested).length || 0;
    const vestingProgress = totalVestingPeriods > 0 ? (vestedPeriods / totalVestingPeriods) * 100 : 0;

    // Find next vesting date
    const nextVestingEvent = grant.vestingSchedule?.find(event => !event.vested);
    const nextVestingDate = nextVestingEvent ? new Date(nextVestingEvent.vestDate) : null;

    // Calculate days until next vesting
    const daysUntilNextVesting = nextVestingDate 
      ? Math.ceil((nextVestingDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      grantSales,
      totalSoldShares,
      totalSaleValue,
      totalTaxPaid,
      totalNetProceeds,
      vestingProgress,
      nextVestingEvent,
      nextVestingDate,
      daysUntilNextVesting,
      availableShares: Math.max(0, grant.vestedShares - totalSoldShares)
    };
  }, [grant, sales]);

  if (!grant || !grantData) return null;

  const isPositiveGainLoss = grant.gainLoss >= 0;
  const grantDateFormatted = new Date(grant.grantDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { height: '90vh', maxHeight: 800 }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        pb: 1
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <InfoIcon color="primary" />
          <Box>
            <Typography variant="h6">
              {grant.stockSymbol}
              {grant.name && ` • ${grant.name}`}
            </Typography>
            {grant.company && (
              <Typography variant="body2" color="text.secondary">
                {grant.company}
              </Typography>
            )}
          </Box>
          <Chip
            size="small"
            label={grant.status}
            color={grant.status === 'active' ? 'success' : 'default'}
            variant="outlined"
          />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {onEdit && (
            <IconButton onClick={handleEdit} size="small" title="Edit Grant">
              <EditIcon />
            </IconButton>
          )}
          {onDelete && (
            <IconButton onClick={handleDelete} size="small" title="Delete Grant" color="error">
              <DeleteIcon />
            </IconButton>
          )}
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ px: 0 }}>
        {/* Key Metrics Summary */}
        <Box sx={{ px: 3, mb: 3 }}>
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
            gap: 3
          }}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <AttachMoneyIcon color="primary" sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="h5" color="primary.main">
                  ${grant.currentValue.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Current Value
                </Typography>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                {isPositiveGainLoss ? (
                  <TrendingUpIcon color="success" sx={{ fontSize: 32, mb: 1 }} />
                ) : (
                  <TrendingDownIcon color="error" sx={{ fontSize: 32, mb: 1 }} />
                )}
                <Typography 
                  variant="h5" 
                  color={isPositiveGainLoss ? 'success.main' : 'error.main'}
                >
                  {isPositiveGainLoss ? '+' : ''}${grant.gainLoss.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Gain/Loss ({isPositiveGainLoss ? '+' : ''}{grant.gainLossPercentage.toFixed(1)}%)
                </Typography>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <ScheduleIcon color="info" sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="h5" color="info.main">
                  {Math.round(grantData.vestingProgress)}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Vested
                </Typography>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <AssessmentIcon color="secondary" sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="h5" color="secondary.main">
                  {grantData.availableShares.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Available Shares
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Box>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="Grant Details" />
            <Tab label="Vesting Schedule" />
            <Tab label="Sales History" />
            <Tab label="Tax Analysis" />
          </Tabs>
        </Box>

        {/* Tab Panels */}
        <Box sx={{ px: 3, flex: 1, overflow: 'auto' }}>
          {/* Grant Details Tab */}
          <TabPanel value={tabValue} index={0}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3 }}>
              {/* Basic Information */}
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Basic Information
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">Stock Symbol</Typography>
                      <Typography variant="body1" fontWeight="medium">{grant.stockSymbol}</Typography>
                    </Box>
                    {grant.company && (
                      <Box>
                        <Typography variant="body2" color="text.secondary">Company</Typography>
                        <Typography variant="body1" fontWeight="medium">{grant.company}</Typography>
                      </Box>
                    )}
                    <Box>
                      <Typography variant="body2" color="text.secondary">Grant Date</Typography>
                      <Typography variant="body1" fontWeight="medium">{grantDateFormatted}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">Status</Typography>
                      <Chip
                        size="small"
                        label={grant.status}
                        color={grant.status === 'active' ? 'success' : 'default'}
                        variant="outlined"
                      />
                    </Box>
                  </Box>
                </CardContent>
              </Card>

              {/* Share Information */}
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Share Information
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">Total Shares</Typography>
                      <Typography variant="body1" fontWeight="medium">{grant.totalShares.toLocaleString()}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">Vested Shares</Typography>
                      <Typography variant="body1" fontWeight="medium" color="success.main">
                        {grant.vestedShares.toLocaleString()}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">Unvested Shares</Typography>
                      <Typography variant="body1" fontWeight="medium" color="warning.main">
                        {grant.unvestedShares.toLocaleString()}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">Sold Shares</Typography>
                      <Typography variant="body1" fontWeight="medium" color="error.main">
                        {grantData.totalSoldShares.toLocaleString()}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">Available Shares</Typography>
                      <Typography variant="body1" fontWeight="medium" color="primary.main">
                        {grantData.availableShares.toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>

              {/* Financial Information */}
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Financial Information
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">Grant Value</Typography>
                      <Typography variant="body1" fontWeight="medium">${grant.totalValue.toLocaleString()}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">Grant Price per Share</Typography>
                      <Typography variant="body1" fontWeight="medium">${grant.pricePerShare.toFixed(2)}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">Current Price per Share</Typography>
                      <Typography variant="body1" fontWeight="medium">${grant.currentPrice.toFixed(2)}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">Current Total Value</Typography>
                      <Typography variant="body1" fontWeight="medium" color="primary.main">
                        ${grant.currentValue.toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>

              {/* Next Vesting */}
              {grantData.nextVestingEvent && (
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Next Vesting Event
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Box>
                        <Typography variant="body2" color="text.secondary">Vesting Date</Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {grantData.nextVestingDate?.toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">Shares to Vest</Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {grantData.nextVestingEvent.shares.toLocaleString()}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">Days Until Vesting</Typography>
                        <Typography 
                          variant="body1" 
                          fontWeight="medium"
                          color={grantData.daysUntilNextVesting && grantData.daysUntilNextVesting <= 7 ? 'warning.main' : 'text.primary'}
                        >
                          {grantData.daysUntilNextVesting !== null ? 
                            grantData.daysUntilNextVesting <= 0 ? 'Today!' : 
                            grantData.daysUntilNextVesting === 1 ? 'Tomorrow' :
                            `${grantData.daysUntilNextVesting} days` 
                            : 'N/A'
                          }
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">Estimated Value</Typography>
                        <Typography variant="body1" fontWeight="medium" color="success.main">
                          ${(grantData.nextVestingEvent.shares * grant.currentPrice).toLocaleString()}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              )}
            </Box>

            {/* Notes */}
            {grant.notes && (
              <Box sx={{ mt: 3 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Notes
                    </Typography>
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                      {grant.notes}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            )}
          </TabPanel>

          {/* Vesting Schedule Tab */}
          <TabPanel value={tabValue} index={1}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Vesting Progress
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={grantData.vestingProgress} 
                sx={{ height: 8, borderRadius: 4, mb: 1 }}
              />
              <Typography variant="body2" color="text.secondary">
                {Math.round(grantData.vestingProgress)}% complete • {grant.vestedShares.toLocaleString()} of {grant.totalShares.toLocaleString()} shares vested
              </Typography>
            </Box>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Vesting Date</TableCell>
                    <TableCell align="right">Shares</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="right">Value at Grant</TableCell>
                    <TableCell align="right">Current Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {grant.vestingSchedule?.map((event, index) => {
                    const vestDate = new Date(event.vestDate);
                    const currentValue = event.shares * grant.currentPrice;
                    const grantValue = event.shares * grant.pricePerShare;
                    
                    return (
                      <TableRow key={index}>
                        <TableCell>
                          {vestDate.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </TableCell>
                        <TableCell align="right">{event.shares.toLocaleString()}</TableCell>
                        <TableCell align="center">
                          <Chip
                            size="small"
                            label={event.vested ? 'Vested' : 'Pending'}
                            color={event.vested ? 'success' : 'default'}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">${grantValue.toLocaleString()}</TableCell>
                        <TableCell align="right">${currentValue.toLocaleString()}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>

          {/* Sales History Tab */}
          <TabPanel value={tabValue} index={2}>
            {grantData.grantSales.length > 0 ? (
              <>
                {/* Sales Summary */}
                <Box sx={{ mb: 3, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center', py: 2 }}>
                      <Typography variant="h6">{grantData.totalSoldShares.toLocaleString()}</Typography>
                      <Typography variant="caption" color="text.secondary">Shares Sold</Typography>
                    </CardContent>
                  </Card>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center', py: 2 }}>
                      <Typography variant="h6">${grantData.totalSaleValue.toLocaleString()}</Typography>
                      <Typography variant="caption" color="text.secondary">Total Sale Value</Typography>
                    </CardContent>
                  </Card>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center', py: 2 }}>
                      <Typography variant="h6" color="error.main">${grantData.totalTaxPaid.toLocaleString()}</Typography>
                      <Typography variant="caption" color="text.secondary">Total Tax Paid</Typography>
                    </CardContent>
                  </Card>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center', py: 2 }}>
                      <Typography variant="h6" color="success.main">${grantData.totalNetProceeds.toLocaleString()}</Typography>
                      <Typography variant="caption" color="text.secondary">Net Proceeds</Typography>
                    </CardContent>
                  </Card>
                </Box>

                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Sale Date</TableCell>
                        <TableCell align="right">Shares</TableCell>
                        <TableCell align="right">Price per Share</TableCell>
                        <TableCell align="right">Sale Value</TableCell>
                        <TableCell align="right">Tax Paid</TableCell>
                        <TableCell align="right">Net Proceeds</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {grantData.grantSales.map((sale, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            {new Date(sale.saleDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </TableCell>
                          <TableCell align="right">{sale.sharesAmount.toLocaleString()}</TableCell>
                          <TableCell align="right">${sale.pricePerShare.toFixed(2)}</TableCell>
                          <TableCell align="right">${sale.totalSaleValue.toLocaleString()}</TableCell>
                          <TableCell align="right" sx={{ color: 'error.main' }}>
                            ${sale.taxCalculation.totalTax.toLocaleString()}
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'success.main' }}>
                            ${sale.taxCalculation.netValue.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <EventNoteIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No Sales Recorded
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  No shares from this grant have been sold yet.
                </Typography>
              </Box>
            )}
          </TabPanel>

          {/* Tax Analysis Tab */}
          <TabPanel value={tabValue} index={3}>
            {grantData.grantSales.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Tax Summary Cards */}
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2 }}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>Tax Efficiency</Typography>
                      <Typography variant="h4" color="info.main">
                        {((grantData.totalNetProceeds / grantData.totalSaleValue) * 100).toFixed(1)}%
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Net proceeds after tax
                      </Typography>
                    </CardContent>
                  </Card>
                  
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>Effective Tax Rate</Typography>
                      <Typography variant="h4" color="error.main">
                        {((grantData.totalTaxPaid / grantData.totalSaleValue) * 100).toFixed(1)}%
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Total tax as % of sale value
                      </Typography>
                    </CardContent>
                  </Card>

                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>Realized Gain</Typography>
                      <Typography variant="h4" color="success.main">
                        ${(grantData.totalSaleValue - (grantData.totalSoldShares * grant.pricePerShare)).toLocaleString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Sale value minus grant value
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>

                {/* Detailed Tax Breakdown */}
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Sale Date</TableCell>
                        <TableCell align="right">Holding Period</TableCell>
                        <TableCell align="right">Wage Income Tax</TableCell>
                        <TableCell align="right">Capital Gains Tax</TableCell>
                        <TableCell align="right">Total Tax</TableCell>
                        <TableCell align="right">Effective Rate</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {grantData.grantSales.map((sale, index) => {
                        const holdingPeriodDays = Math.floor((new Date(sale.saleDate).getTime() - new Date(grant.grantDate).getTime()) / (1000 * 60 * 60 * 24));
                        const isLongTerm = holdingPeriodDays >= 730; // 2 years
                        
                        return (
                          <TableRow key={index}>
                            <TableCell>
                              {new Date(sale.saleDate).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </TableCell>
                            <TableCell align="right">
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                                {holdingPeriodDays} days
                                <Chip
                                  size="small"
                                  label={isLongTerm ? 'Long-term' : 'Short-term'}
                                  color={isLongTerm ? 'success' : 'warning'}
                                  variant="outlined"
                                />
                              </Box>
                            </TableCell>
                            <TableCell align="right">${sale.taxCalculation.wageIncomeTax.toLocaleString()}</TableCell>
                            <TableCell align="right">${sale.taxCalculation.capitalGainsTax.toLocaleString()}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'medium' }}>
                              ${sale.taxCalculation.totalTax.toLocaleString()}
                            </TableCell>
                            <TableCell align="right">
                              {(sale.effectiveTaxRate * 100).toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <AssessmentIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No Tax Data Available
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Tax analysis will be available after recording your first sale.
                </Typography>
              </Box>
            )}
          </TabPanel>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
        {onEdit && (
          <Button onClick={handleEdit} variant="contained" startIcon={<EditIcon />}>
            Edit Grant
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default GrantDetailsDialog;
