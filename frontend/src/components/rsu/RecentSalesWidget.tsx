import React from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Skeleton,
  Card,
  CardContent,
  Divider
} from '@mui/material';
import {
  SellOutlined as SellIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Receipt as ReceiptIcon
} from '@mui/icons-material';
import { useRSU } from '../../contexts/RSUContext';
import { RSUSale } from '../../services/api/rsus';

interface RecentSalesWidgetProps {
  maxSales?: number;
}

const RecentSalesWidget: React.FC<RecentSalesWidgetProps> = ({
  maxSales = 5
}) => {
  const { sales, salesLoading, grants } = useRSU();

  // Get recent sales and sort by date
  const recentSales = sales
    .sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime())
    .slice(0, maxSales);

  // Helper function to get grant info for a sale
  const getGrantInfo = (saleGrantId: any) => {
    // Handle both string grantId and populated grant object
    const grantId = typeof saleGrantId === 'string' ? saleGrantId : saleGrantId?._id;
    return grants.find(grant => grant._id === grantId);
  };

  if (salesLoading) {
    return (
      <Box>
        {[1, 2, 3].map((item) => (
          <Box key={item} sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Skeleton variant="circular" width={24} height={24} />
              <Skeleton variant="text" width="40%" height={20} />
            </Box>
            <Skeleton variant="text" width="60%" height={16} />
            <Skeleton variant="text" width="80%" height={16} />
          </Box>
        ))}
      </Box>
    );
  }

  if (recentSales.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <ReceiptIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No Sales Recorded
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Record your first RSU sale to see transaction history
        </Typography>
      </Box>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // Format the date
    const formatted = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });

    // Add relative time
    if (diffDays === 0) {
      return { date: formatted, relative: 'Today' };
    } else if (diffDays === 1) {
      return { date: formatted, relative: 'Yesterday' };
    } else if (diffDays <= 7) {
      return { date: formatted, relative: `${diffDays} days ago` };
    } else if (diffDays <= 30) {
      const weeks = Math.floor(diffDays / 7);
      return { date: formatted, relative: `${weeks} week${weeks > 1 ? 's' : ''} ago` };
    } else if (diffDays <= 365) {
      const months = Math.floor(diffDays / 30);
      return { date: formatted, relative: `${months} month${months > 1 ? 's' : ''} ago` };
    } else {
      const years = Math.floor(diffDays / 365);
      return { date: formatted, relative: `${years} year${years > 1 ? 's' : ''} ago` };
    }
  };

  // Calculate total recent sales stats
  const totalSalesValue = recentSales.reduce((sum, sale) => sum + sale.totalSaleValue, 0);
  const totalNetProceeds = recentSales.reduce((sum, sale) => sum + sale.taxCalculation.netValue, 0);
  const totalTaxesPaid = recentSales.reduce((sum, sale) => sum + sale.taxCalculation.totalTax, 0);

  return (
    <Box>
      {/* Summary Header */}
      <Card variant="outlined" sx={{ mb: 2, bgcolor: 'action.hover' }}>
        <CardContent sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Last {recentSales.length} Sales
              </Typography>
              <Typography variant="h6" color="primary">
                ${totalSalesValue.toLocaleString()}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="body2" color="text.secondary">
                Net Proceeds
              </Typography>
              <Typography variant="h6" color="success.main">
                ${totalNetProceeds.toLocaleString()}
              </Typography>
            </Box>
          </Box>
          {totalTaxesPaid > 0 && (
            <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">
                Total taxes paid: ${totalTaxesPaid.toLocaleString()}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Sales List */}
      <List sx={{ p: 0 }}>
        {recentSales.map((sale, index) => {
          const grant = getGrantInfo(sale.grantId);
          const { date, relative } = formatDate(sale.saleDate);
          const isProfit = sale.taxCalculation.profit >= 0;

          return (
            <React.Fragment key={sale._id}>
              <ListItem sx={{ px: 0, py: 1.5 }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <SellIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2" component="div">
                          {grant?.stockSymbol || 'Unknown'}
                          {grant?.name && ` • ${grant.name}`}
                          {grant?.company && !grant?.name && ` • ${grant.company}`}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" component="div">
                          {sale.sharesAmount.toLocaleString()} shares @ ${sale.pricePerShare.toFixed(2)}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          {isProfit ? (
                            <TrendingUpIcon fontSize="small" color="success" />
                          ) : (
                            <TrendingDownIcon fontSize="small" color="error" />
                          )}
                          <Typography 
                            variant="caption" 
                            color={isProfit ? 'success.main' : 'error.main'}
                          >
                            {isProfit ? '+' : ''}${sale.taxCalculation.profit.toLocaleString()} profit
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ textAlign: 'right', ml: 2 }}>
                        <Typography variant="body2" fontWeight="medium">
                          ${sale.totalSaleValue.toLocaleString()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {date}
                        </Typography>
                        <Box sx={{ mt: 0.5 }}>
                          <Chip
                            label={relative}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: 18 }}
                          />
                        </Box>
                      </Box>
                    </Box>
                  }
                  secondary={
                    <span style={{ marginTop: '4px', display: 'block' }}>
                      <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ display: 'flex', gap: '16px' }}>
                          <Typography variant="caption" color="text.secondary" component="span">
                            Tax: ${sale.taxCalculation.totalTax.toLocaleString()}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" component="span">
                            Net: ${sale.taxCalculation.netValue.toLocaleString()}
                          </Typography>
                        </span>
                        <span>
                          <Chip
                            label={sale.taxCalculation.isLongTerm ? 'Long-term' : 'Short-term'}
                            size="small"
                            color={sale.taxCalculation.isLongTerm ? 'success' : 'warning'}
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: 18 }}
                          />
                        </span>
                      </span>
                    </span>
                  }
                />
              </ListItem>
              {index < recentSales.length - 1 && <Divider />}
            </React.Fragment>
          );
        })}
      </List>

      {/* Show More Indicator */}
      {sales.length > maxSales && (
        <Box sx={{ textAlign: 'center', mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary">
            +{sales.length - maxSales} more sales
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default RecentSalesWidget;
