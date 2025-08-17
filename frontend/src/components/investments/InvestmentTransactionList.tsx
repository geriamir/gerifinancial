import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Typography,
  Box,
  IconButton,
  Menu,
  MenuItem,
  LinearProgress,
  Alert,
  Button,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AttachMoney as DividendIcon,
  SwapHoriz as OtherIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import {
  InvestmentTransaction,
  TransactionType,
  TRANSACTION_TYPE_COLORS,
  TRANSACTION_TYPE_LABELS
} from '../../types/investmentTransaction';
import { useInvestmentTransactions } from '../../hooks/useInvestmentTransactions';

interface InvestmentTransactionListProps {
  investmentId?: string;
  showInvestmentColumn?: boolean;
  showActions?: boolean;
  maxHeight?: string;
  compact?: boolean;
}

const TRANSACTION_ICONS: Record<TransactionType, React.ReactElement> = {
  BUY: <TrendingUpIcon fontSize="small" />,
  SELL: <TrendingDownIcon fontSize="small" />,
  DIVIDEND: <DividendIcon fontSize="small" />,
  OTHER: <OtherIcon fontSize="small" />
};

export const InvestmentTransactionList: React.FC<InvestmentTransactionListProps> = ({
  investmentId,
  showInvestmentColumn = false,
  showActions = true,
  maxHeight = '600px',
  compact = false
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<InvestmentTransaction | null>(null);

  const {
    transactions,
    totalCount,
    hasMore,
    loading,
    error,
    refetch,
    loadMore
  } = useInvestmentTransactions({
    investmentId,
    initialFilters: {
      limit: 25,
      offset: 0
    }
  });

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, transaction: InvestmentTransaction) => {
    setAnchorEl(event.currentTarget);
    setSelectedTransaction(transaction);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedTransaction(null);
  };

  const handleViewDetails = () => {
    if (selectedTransaction) {
      // TODO: Open transaction details modal or navigate to detail page
      console.log('View details for transaction:', selectedTransaction._id);
    }
    handleMenuClose();
  };

  const handleViewSymbolTransactions = () => {
    if (selectedTransaction) {
      // TODO: Filter transactions by symbol or navigate to symbol page
      console.log('View all transactions for symbol:', selectedTransaction.symbol);
    }
    handleMenuClose();
  };

  const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(Math.abs(value));
  };

  const formatShares = (amount: number, transactionType: TransactionType) => {
    if (transactionType === 'DIVIDEND') return '';
    
    const absAmount = Math.abs(amount);
    return `${absAmount.toLocaleString()} ${absAmount === 1 ? 'share' : 'shares'}`;
  };

  const getTransactionChip = (transaction: InvestmentTransaction) => {
    const type = transaction.transactionType;
    const color = TRANSACTION_TYPE_COLORS[type];
    const label = TRANSACTION_TYPE_LABELS[type];
    const icon = TRANSACTION_ICONS[type];

    return (
      <Chip
        icon={icon}
        label={label}
        size="small"
        sx={{
          backgroundColor: `${color}20`,
          color: color,
          borderColor: color,
          '& .MuiChip-icon': {
            color: color
          }
        }}
      />
    );
  };

  const renderMobileCard = (transaction: InvestmentTransaction) => (
    <Paper
      key={transaction._id}
      sx={{ p: 2, mb: 1, border: `1px solid ${theme.palette.divider}` }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
        <Box>
          <Typography variant="h6" component="div">
            {transaction.symbol}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {transaction.paperName}
          </Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={1}>
          {getTransactionChip(transaction)}
          {showActions && (
            <IconButton
              size="small"
              onClick={(e) => handleMenuOpen(e, transaction)}
            >
              <MoreVertIcon />
            </IconButton>
          )}
        </Box>
      </Box>

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Box>
          <Typography variant="body2" color="text.secondary">
            {format(parseISO(transaction.executionDate), 'MMM dd, yyyy')}
          </Typography>
          <Typography variant="body2">
            {formatShares(transaction.amount, transaction.transactionType)}
          </Typography>
        </Box>
        <Box textAlign="right">
          <Typography variant="body1" fontWeight="medium">
            {formatCurrency(transaction.value, transaction.currency)}
          </Typography>
          {transaction.executablePrice && (
            <Typography variant="body2" color="text.secondary">
              @ {formatCurrency(transaction.executablePrice, transaction.currency)}
            </Typography>
          )}
        </Box>
      </Box>

      {transaction.taxSum && transaction.taxSum > 0 && (
        <Typography variant="caption" color="text.secondary">
          Tax: {formatCurrency(transaction.taxSum, transaction.currency)}
        </Typography>
      )}
    </Paper>
  );

  if (error) {
    return (
      <Alert 
        severity="error" 
        action={
          <Button color="inherit" size="small" onClick={refetch}>
            Retry
          </Button>
        }
      >
        {error.message}
      </Alert>
    );
  }

  if (isMobile) {
    return (
      <Box>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            Investment Transactions ({totalCount})
          </Typography>
          <Box>
            <IconButton onClick={refetch} disabled={loading}>
              <RefreshIcon />
            </IconButton>
            <IconButton>
              <FilterIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Loading */}
        {loading && <LinearProgress sx={{ mb: 2 }} />}

        {/* Mobile Cards */}
        <Box>
          {transactions.map(renderMobileCard)}
        </Box>

        {/* Load More */}
        {hasMore && (
          <Box display="flex" justifyContent="center" mt={2}>
            <Button onClick={loadMore} disabled={loading}>
              Load More ({totalCount - transactions.length} remaining)
            </Button>
          </Box>
        )}

        {/* Action Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={handleViewDetails}>
            View Details
          </MenuItem>
          <MenuItem onClick={handleViewSymbolTransactions}>
            All {selectedTransaction?.symbol} Transactions
          </MenuItem>
        </Menu>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">
          Investment Transactions ({totalCount})
        </Typography>
        <Box>
          <IconButton onClick={refetch} disabled={loading}>
            <RefreshIcon />
          </IconButton>
          <IconButton>
            <FilterIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Loading */}
      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Desktop Table */}
      <TableContainer 
        component={Paper} 
        sx={{ maxHeight, overflow: 'auto' }}
      >
        <Table stickyHeader size={compact ? 'small' : 'medium'}>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Symbol</TableCell>
              <TableCell>Security Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell align="right">Shares</TableCell>
              <TableCell align="right">Price</TableCell>
              <TableCell align="right">Value</TableCell>
              <TableCell align="right">Tax</TableCell>
              {showInvestmentColumn && <TableCell>Account</TableCell>}
              {showActions && <TableCell align="center">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {transactions.map((transaction) => (
              <TableRow
                key={transaction._id}
                hover
                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
              >
                {/* Date */}
                <TableCell>
                  <Typography variant="body2">
                    {format(parseISO(transaction.executionDate), 'MMM dd, yyyy')}
                  </Typography>
                </TableCell>

                {/* Symbol */}
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {transaction.symbol}
                  </Typography>
                </TableCell>

                {/* Security Name */}
                <TableCell>
                  <Typography variant="body2" noWrap>
                    {transaction.paperName}
                  </Typography>
                </TableCell>

                {/* Type */}
                <TableCell>
                  {getTransactionChip(transaction)}
                </TableCell>

                {/* Shares */}
                <TableCell align="right">
                  <Typography variant="body2">
                    {formatShares(transaction.amount, transaction.transactionType)}
                  </Typography>
                </TableCell>

                {/* Price */}
                <TableCell align="right">
                  <Typography variant="body2">
                    {transaction.executablePrice 
                      ? formatCurrency(transaction.executablePrice, transaction.currency)
                      : '-'
                    }
                  </Typography>
                </TableCell>

                {/* Value */}
                <TableCell align="right">
                  <Typography 
                    variant="body2" 
                    fontWeight="medium"
                    color={transaction.transactionType === 'SELL' ? 'success.main' : 'text.primary'}
                  >
                    {formatCurrency(transaction.value, transaction.currency)}
                  </Typography>
                </TableCell>

                {/* Tax */}
                <TableCell align="right">
                  <Typography variant="body2">
                    {transaction.taxSum && transaction.taxSum > 0
                      ? formatCurrency(transaction.taxSum, transaction.currency)
                      : '-'
                    }
                  </Typography>
                </TableCell>

                {/* Investment Account */}
                {showInvestmentColumn && (
                  <TableCell>
                    <Typography variant="body2">
                      {transaction.investmentId_populated?.accountName || 
                       transaction.investmentId_populated?.accountNumber ||
                       'Unknown Account'}
                    </Typography>
                  </TableCell>
                )}

                {/* Actions */}
                {showActions && (
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, transaction)}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Load More */}
      {hasMore && (
        <Box display="flex" justifyContent="center" mt={2}>
          <Button onClick={loadMore} disabled={loading} variant="outlined">
            Load More ({totalCount - transactions.length} remaining)
          </Button>
        </Box>
      )}

      {/* Empty State */}
      {!loading && transactions.length === 0 && (
        <Box 
          display="flex" 
          flexDirection="column" 
          alignItems="center" 
          justifyContent="center" 
          py={4}
        >
          <Typography variant="h6" color="text.secondary" mb={1}>
            No transactions found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {investmentId 
              ? 'This investment account has no transaction history.'
              : 'No investment transactions are available.'
            }
          </Typography>
        </Box>
      )}

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleViewDetails}>
          View Details
        </MenuItem>
        <MenuItem onClick={handleViewSymbolTransactions}>
          All {selectedTransaction?.symbol} Transactions
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default InvestmentTransactionList;
