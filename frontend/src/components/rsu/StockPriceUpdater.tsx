import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  TextField,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Chip
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon
} from '@mui/icons-material';
import { RSUGrant, rsuApi } from '../../services/api/rsus';

interface StockPriceUpdaterProps {
  open: boolean;
  onClose: () => void;
  grant: RSUGrant | null;
  onPriceUpdate?: (newPrice: number) => void;
}

const StockPriceUpdater: React.FC<StockPriceUpdaterProps> = ({
  open,
  onClose,
  grant,
  onPriceUpdate
}) => {
  const [newPrice, setNewPrice] = useState('');
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  React.useEffect(() => {
    if (grant && open) {
      setNewPrice(grant.currentPrice.toString());
      setError(null);
      setSuccess(false);
    }
  }, [grant, open]);

  const handlePriceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNewPrice(event.target.value);
    setError(null);
    setSuccess(false);
  };

  const validatePrice = (): string | null => {
    if (!newPrice.trim()) return 'Price is required';
    const price = parseFloat(newPrice);
    if (isNaN(price) || price <= 0) return 'Price must be a positive number';
    return null;
  };

  const handleUpdatePrice = async () => {
    const validationError = validatePrice();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!grant) return;

    try {
      setUpdating(true);
      setError(null);

      // Update stock price via API service
      const price = parseFloat(newPrice);
      await rsuApi.stockPrice.update(grant.stockSymbol, price, grant.company);

      onPriceUpdate?.(price);
      setSuccess(true);
      
      // Auto close after success
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update price');
    } finally {
      setUpdating(false);
    }
  };

  const handleFetchFromAPI = async () => {
    if (!grant) return;

    try {
      setUpdating(true);
      setError(null);

      // Fetch live price via API service (uses Yahoo Finance, Alpha Vantage, etc.)
      const stockPrice = await rsuApi.stockPrice.get(grant.stockSymbol);
      
      setNewPrice(stockPrice.price.toFixed(2));
      setSuccess(true);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch price from external API');
    } finally {
      setUpdating(false);
    }
  };

  if (!grant) return null;

  const currentPrice = grant.currentPrice;
  const inputPrice = parseFloat(newPrice) || 0;
  const priceChange = inputPrice - currentPrice;
  const priceChangePercent = currentPrice > 0 ? (priceChange / currentPrice) * 100 : 0;
  const isPositiveChange = priceChange >= 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        Update Stock Price - {grant.stockSymbol}
      </DialogTitle>

      <DialogContent>
        {/* Current Price Info */}
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {grant.company}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Current Price
                </Typography>
                <Typography variant="h5">
                  ${currentPrice.toFixed(2)}
                </Typography>
              </Box>
              <Chip
                label={`Grant: $${grant.pricePerShare.toFixed(2)}`}
                variant="outlined"
                size="small"
              />
            </Box>
          </CardContent>
        </Card>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Price updated successfully!
          </Alert>
        )}

        {/* Price Update Form */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
            <TextField
              fullWidth
              label="New Price (USD)"
              value={newPrice}
              onChange={handlePriceChange}
              placeholder={currentPrice.toFixed(2)}
              type="number"
              inputProps={{ min: 0, step: 0.01 }}
              disabled={updating}
            />
            <Button
              variant="outlined"
              startIcon={updating ? <CircularProgress size={16} /> : <RefreshIcon />}
              onClick={handleFetchFromAPI}
              disabled={updating}
              sx={{ whiteSpace: 'nowrap' }}
            >
              {updating ? 'Fetching...' : 'Fetch Live'}
            </Button>
          </Box>

          {/* Price Change Preview */}
          {inputPrice > 0 && inputPrice !== currentPrice && (
            <Card variant="outlined" sx={{ bgcolor: 'action.hover' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Price Change Preview
                </Typography>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Change Amount
                    </Typography>
                    <Typography 
                      variant="h6"
                      color={isPositiveChange ? 'success.main' : 'error.main'}
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                      data-testid="price-change-amount"
                    >
                      {isPositiveChange ? <TrendingUpIcon fontSize="small" /> : <TrendingDownIcon fontSize="small" />}
                      {isPositiveChange ? '+' : ''}${priceChange.toFixed(2)}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="body2" color="text.secondary">
                      Change Percent
                    </Typography>
                    <Typography 
                      variant="h6"
                      color={isPositiveChange ? 'success.main' : 'error.main'}
                      data-testid="price-change-percent"
                    >
                      {isPositiveChange ? '+' : ''}{priceChangePercent.toFixed(2)}%
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      New Portfolio Value
                    </Typography>
                    <Typography variant="h6" color="primary" data-testid="new-portfolio-value">
                      ${(grant.totalShares * inputPrice).toLocaleString()}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="body2" color="text.secondary">
                      Impact on Gain/Loss
                    </Typography>
                    <Typography 
                      variant="h6"
                      color={isPositiveChange ? 'success.main' : 'error.main'}
                      data-testid="gain-loss-impact"
                    >
                      {isPositiveChange ? '+' : ''}${(grant.totalShares * priceChange).toLocaleString()}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          )}

          <Typography variant="caption" color="text.secondary">
            <strong>Note:</strong> Stock prices should be updated regularly for accurate portfolio tracking. 
            Use "Fetch Live" to get the latest price from Yahoo Finance or Alpha Vantage APIs.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} disabled={updating}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleUpdatePrice}
          disabled={validatePrice() !== null || updating || success}
          startIcon={updating ? <CircularProgress size={20} /> : null}
        >
          {updating ? 'Updating...' : 'Update Price'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StockPriceUpdater;
