import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  List,
  ListItem,
  Chip,
  IconButton,
  Tooltip,
  Collapse,
  Divider
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  AccountBalance as AccountIcon
} from '@mui/icons-material';
import { Investment, Holding } from '../../services/api/types/investment';
import { formatCurrency } from '../../utils/formatters';

interface InvestmentAccountListProps {
  investments: Investment[];
  loading: boolean;
  onRefresh: () => void;
}

interface GroupedAccount {
  bankAccountId: string;
  accountName: string;
  accountType: string;
  currency: string;
  totalValue: number;
  totalMarketValue: number;
  cashBalance: number;
  lastUpdated: Date;
  holdings: Holding[];
}

function groupByBankAccount(investments: Investment[]): GroupedAccount[] {
  const groups = new Map<string, GroupedAccount>();

  for (const inv of investments) {
    const key = inv.bankAccountId;
    const existing = groups.get(key);

    if (existing) {
      existing.totalValue += inv.totalValue || 0;
      existing.totalMarketValue += inv.totalMarketValue || 0;
      existing.cashBalance += inv.cashBalance || 0;
      existing.holdings.push(...inv.holdings);
      if (new Date(inv.lastUpdated) > new Date(existing.lastUpdated)) {
        existing.lastUpdated = inv.lastUpdated;
      }
    } else {
      groups.set(key, {
        bankAccountId: key,
        accountName: inv.accountName || `Account ${inv.accountNumber}`,
        accountType: inv.accountType,
        currency: inv.currency,
        totalValue: inv.totalValue || 0,
        totalMarketValue: inv.totalMarketValue || 0,
        cashBalance: inv.cashBalance || 0,
        lastUpdated: inv.lastUpdated,
        holdings: [...inv.holdings]
      });
    }
  }

  return Array.from(groups.values());
}

interface GroupedAccountItemProps {
  account: GroupedAccount;
}

const GroupedAccountItem: React.FC<GroupedAccountItemProps> = ({ account }) => {
  const [expanded, setExpanded] = React.useState(false);

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
              {account.accountName}
            </Typography>
            <Chip
              label={account.accountType}
              size="small"
              color={getAccountTypeColor(account.accountType) as any}
              variant="outlined"
            />
          </Box>
          
          <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                {formatCurrency(account.totalValue, account.currency)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Total Value
              </Typography>
            </Box>
            
            {account.totalMarketValue > 0 && (
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {formatCurrency(account.totalMarketValue, account.currency)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Investments
                </Typography>
              </Box>
            )}
            
            {account.cashBalance > 0 && (
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {formatCurrency(account.cashBalance, account.currency)}
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
            {formatLastUpdated(account.lastUpdated)}
          </Typography>
          
          {account.holdings.length > 0 && (
            <Tooltip title={expanded ? 'Hide holdings' : 'Show holdings'}>
              <IconButton onClick={() => setExpanded(!expanded)} size="small">
                {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Holdings Details */}
      {account.holdings.length > 0 && (
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Divider sx={{ my: 1 }} />
          <Box sx={{ px: 1, pb: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
              Holdings ({account.holdings.length})
            </Typography>
            
            <Box sx={{ display: 'grid', gap: 1 }}>
              {account.holdings.map((holding, index) => (
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
                          Price: {formatCurrency(holding.price, holding.currency || account.currency)}
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
                        {formatCurrency(holding.marketValue, holding.currency || account.currency)}
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
  const grouped = groupByBankAccount(activeInvestments);
  const totalValue = grouped.reduce((sum, g) => sum + g.totalValue, 0);
  const currency = grouped.length === 1 ? grouped[0].currency : undefined;

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
              label={`${grouped.length} account${grouped.length !== 1 ? 's' : ''}`}
              size="small"
              variant="outlined"
            />
          </Box>
          
          {totalValue > 0 && (
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                {formatCurrency(totalValue, currency)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Total Value
              </Typography>
            </Box>
          )}
        </Box>

        {/* Investment List */}
        {grouped.length > 0 ? (
          <List sx={{ p: 0 }}>
            {grouped.map((account) => (
              <GroupedAccountItem
                key={account.bankAccountId}
                account={account}
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
