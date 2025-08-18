import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Box,
  IconButton,
  Menu,
  MenuItem,
  LinearProgress,
  Alert,
  Button,
  useTheme,
  useMediaQuery,
  Chip
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  TrendingUp as IncomeIcon,
  TrendingDown as ExpenseIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  SwapHoriz as ConvertIcon
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import {
  useForeignCurrencyTransactions,
  useForeignCurrencyFormatters
} from '../../hooks/useForeignCurrency';
import {
  Transaction,
  getCurrencySymbol
} from '../../types/foreignCurrency';

interface ForeignCurrencyTransactionListProps {
  accountId?: string;
  showAccountColumn?: boolean;
  showActions?: boolean;
  maxHeight?: string;
  compact?: boolean;
}

export const ForeignCurrencyTransactionList: React.FC<ForeignCurrencyTransactionListProps> = ({
  accountId,
  showAccountColumn = false,
  showActions = true,
  maxHeight = '600px',
  compact = false
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const {
    transactions,
    pagination,
    account,
    loading,
    error,
    loadMore,
    refresh,
    hasMore
  } = useForeignCurrencyTransactions(accountId || null);

  const { formatTransactionAmount } = useForeignCurrencyFormatters();

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, transaction: Transaction) => {
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

  const handleConvertAmount = () => {
    if (selectedTransaction) {
      // TODO: Open currency converter with pre-filled amount
      console.log('Convert amount:', selectedTransaction.amount, selectedTransaction.currency);
    }
    handleMenuClose();
  };

  const getTransactionChip = (transaction: Transaction) => {
    const { isIncome } = formatTransactionAmount(transaction);
    
    return (
      <Chip
        icon={isIncome ? <IncomeIcon fontSize="small" /> : <ExpenseIcon fontSize="small" />}
        label={isIncome ? 'Income' : 'Expense'}
        size="small"
        sx={{
          backgroundColor: isIncome ? '#4caf5020' : '#f4433620',
          color: isIncome ? '#4caf50' : '#f44336',
          borderColor: isIncome ? '#4caf50' : '#f44336',
          '& .MuiChip-icon': {
            color: isIncome ? '#4caf50' : '#f44336'
          }
        }}
      />
    );
  };

  const renderMobileCard = (transaction: Transaction) => (
    <Paper
      key={transaction._id}
      sx={{ p: 2, mb: 1, border: `1px solid ${theme.palette.divider}` }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
        <Box>
          <Typography variant="h6" component="div">
            {transaction.description || 'Transaction'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {transaction.memo || ''}
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
            {format(parseISO(transaction.date), 'MMM dd, yyyy')}
          </Typography>
          <Typography variant="body2">
            {getCurrencySymbol(transaction.currency)} {transaction.currency}
          </Typography>
        </Box>
        <Box textAlign="right">
          <Typography 
            variant="body1" 
            fontWeight="medium"
            color={formatTransactionAmount(transaction).color}
          >
            {formatTransactionAmount(transaction).formattedAmount}
          </Typography>
        </Box>
      </Box>

      {transaction.identifier && (
        <Typography variant="caption" color="text.secondary">
          ID: {transaction.identifier}
        </Typography>
      )}
    </Paper>
  );

  if (error) {
    return (
      <Alert 
        severity="error" 
        action={
          <Button color="inherit" size="small" onClick={refresh}>
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  if (isMobile) {
    return (
      <Box>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            {account ? `${getCurrencySymbol(account.currency)} ${account.currency} Transactions` : 'Foreign Currency Transactions'} ({pagination.total})
          </Typography>
          <Box>
            <IconButton onClick={refresh} disabled={loading}>
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
              Load More ({pagination.total - transactions.length} remaining)
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
          <MenuItem onClick={handleConvertAmount}>
            <ConvertIcon sx={{ mr: 1, fontSize: 20 }} />
            Convert Amount
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
          {account ? `${getCurrencySymbol(account.currency)} ${account.currency} Transactions` : 'Foreign Currency Transactions'} ({pagination.total})
        </Typography>
        <Box>
          <IconButton onClick={refresh} disabled={loading}>
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
              <TableCell>Description</TableCell>
              <TableCell>Memo</TableCell>
              <TableCell>Type</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Identifier</TableCell>
              {showAccountColumn && <TableCell>Account</TableCell>}
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
                    {format(parseISO(transaction.date), 'MMM dd, yyyy')}
                  </Typography>
                </TableCell>

                {/* Description */}
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {transaction.description || 'Transaction'}
                  </Typography>
                </TableCell>

                {/* Memo */}
                <TableCell>
                  <Typography variant="body2" noWrap>
                    {transaction.memo || '-'}
                  </Typography>
                </TableCell>

                {/* Type */}
                <TableCell>
                  {getTransactionChip(transaction)}
                </TableCell>

                {/* Amount */}
                <TableCell align="right">
                  <Typography 
                    variant="body2" 
                    fontWeight="medium"
                    color={formatTransactionAmount(transaction).color}
                  >
                    {formatTransactionAmount(transaction).formattedAmount}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {getCurrencySymbol(transaction.currency)} {transaction.currency}
                  </Typography>
                </TableCell>

                {/* Category */}
                <TableCell>
                  <Typography variant="body2">
                    {transaction.category?.name || transaction.type || '-'}
                  </Typography>
                </TableCell>

                {/* Identifier */}
                <TableCell>
                  <Typography variant="body2">
                    {transaction.identifier || '-'}
                  </Typography>
                </TableCell>

                {/* Account */}
                {showAccountColumn && (
                  <TableCell>
                    <Typography variant="body2">
                      {account?.displayName || account?.currency || 'Unknown Account'}
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
            Load More ({pagination.total - transactions.length} remaining)
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
            {accountId 
              ? 'This foreign currency account has no transaction history.'
              : 'No foreign currency transactions are available.'
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
        <MenuItem onClick={handleConvertAmount}>
          <ConvertIcon sx={{ mr: 1, fontSize: 20 }} />
          Convert Amount
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default ForeignCurrencyTransactionList;
