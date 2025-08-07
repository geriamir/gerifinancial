import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  Chip,
  IconButton,
  Tooltip,
  Collapse,
  Divider
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  AccountBalance as AccountIcon,
  TrendingUp as GainIcon,
  TrendingDown as LossIcon
} from '@mui/icons-material';
import { Investment } from '../../services/api/types/investment';
import { formatCurrency, formatPercentage } from '../../utils/formatters';

interface InvestmentAccountListProps {
  investments: Investment[];
  loading: boolean;
  onRefresh: () => void;
}

interface InvestmentAccountItemProps {
  investment: Investment;
}

const InvestmentAccountItem: React.FC<InvestmentAccountItemProps> = ({ investment }) => {
  const [expanded, setExpanded] = React.useState(false);

  const handleExpandClick = () => {
    setExpanded(!expanded);
  };

  const formatLastUpdated = (date: Date) => {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - new Date(date).getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    
    return new Date(date).toLocaleDateString();
  };

  const getAccountTypeColor = (type: string) => {
    switch (type) {
      case 'investment': return 'primary';
      case 'pension': return 'secondary';
      case 'savings': return 'success';
      default: return 'default';
    }
  };

  return (
    <ListItem
      sx={{
        flexDirection: 'column',
        alignItems: 'stretch',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        mb: 1,
        '&:last-child': { mb: 0 }
      }}
    >
      {/* Main Account Info */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          py: 1
        }}
      >
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {investment.accountName || `Account ${investment.accountNumber}`}
            </Typography>
            <Chip
              label={investment.accountType}
              size="small"
              color={getAccountTypeColor(investment.accountType) as any}
              variant="outlined"
            />
          </Box>
          
          <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                {formatCurrency(investment.totalValue)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Total Value
              </Typography>
            </Box>
            
            {investment.totalMarketValue > 0 && (
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {formatCurrency(investment.totalMarketValue)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Investments
                </Typography>
              </Box>
            )}
            
            {investment.cashBalance > 0 && (
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {formatCurrency(investment.cashBalance)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Cash
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {formatLastUpdated(investment.lastUpdated)}
          </Typography>
          
          {investment.holdings.length > 0 && (
            <Tooltip title={expanded ? 'Hide holdings' : 'Show holdings'}>
              <IconButton onClick={handleExpandClick} size="small">
                {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Holdings Details */}
      {investment.holdings.length > 0 && (
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Divider sx={{ my: 1 }} />
          <Box sx={{ px: 1, pb: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
              Holdings ({investment.holdings.length})
            </Typography>
            
            <Box sx={{ display: 'grid', gap: 1 }}>
              {investment.holdings.map((holding, index) => (
                <Box
                  key={`${holding.symbol}-${index}`}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    p: 1,
                    backgroundColor: 'grey.50',
                    borderRadius: 1
                  }}
                >
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {holding.symbol}
                    </Typography>
                    {holding.name && (
                      <Typography variant="caption" color="text.secondary">
                        {holding.name}
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                      <Typography variant="caption">
                        Qty: {holding.quantity.toLocaleString()}
                      </Typography>
                      {holding.price && (
                        <Typography variant="caption">
                          Price: {formatCurrency(holding.price)}
                        </Typography>
                      )}
                      {holding.sector && (
                        <Chip
                          label={holding.sector}
                          size="small"
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      )}
                    </Box>
                  </Box>
                  
                  <Box sx={{ textAlign: 'right' }}>
                    {holding.marketValue && (
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {formatCurrency(holding.marketValue)}
                      </Typography>
                    )}
                    <Chip
                      label={holding.holdingType}
                      size="small"
                      variant="outlined"
                      sx={{ mt: 0.5 }}
                    />
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Collapse>
      )}
    </ListItem>
  );
};

export const InvestmentAccountList: React.FC<InvestmentAccountListProps> = ({
  investments,
  loading,
  onRefresh
}) => {
  const activeInvestments = investments.filter(inv => inv.status === 'active');
  const totalValue = activeInvestments.reduce((sum, inv) => sum + inv.totalValue, 0);

  return (
    <Card>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccountIcon color="primary" />
            <Typography variant="h6" component="h2">
              Investment Accounts
            </Typography>
            <Chip
              label={`${activeInvestments.length} account${activeInvestments.length !== 1 ? 's' : ''}`}
              size="small"
              variant="outlined"
            />
          </Box>
          
          {totalValue > 0 && (
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                {formatCurrency(totalValue)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Total Value
              </Typography>
            </Box>
          )}
        </Box>

        {/* Investment List */}
        {activeInvestments.length > 0 ? (
          <List sx={{ p: 0 }}>
            {activeInvestments.map((investment) => (
              <InvestmentAccountItem
                key={investment._id}
                investment={investment}
              />
            ))}
          </List>
        ) : (
          !loading && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                No investment accounts found
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Connect your bank accounts and sync to view your investments
              </Typography>
            </Box>
          )
        )}
      </CardContent>
    </Card>
  );
};
