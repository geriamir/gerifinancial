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
  AccountBalance as AccountIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon
} from '@mui/icons-material';
import { Investment, Holding, PortfolioCashBalances, HoldingsPriceData } from '../../services/api/types/investment';
import { formatCurrency } from '../../utils/formatters';
import { HoldingTimelineChart } from './HoldingTimelineChart';

interface InvestmentAccountListProps {
  investments: Investment[];
  portfolioCashBalances: PortfolioCashBalances;
  holdingsPriceData: HoldingsPriceData;
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

function groupByBankAccount(investments: Investment[], portfolioCashBalances: PortfolioCashBalances): GroupedAccount[] {
  const groups = new Map<string, GroupedAccount>();

  for (const inv of investments) {
    // bankAccountId may be a populated object or a plain string
    const key = typeof inv.bankAccountId === 'object'
      ? (inv.bankAccountId as any)._id
      : inv.bankAccountId;
    const existing = groups.get(key);

    if (existing) {
      existing.totalValue += inv.totalValue || 0;
      existing.totalMarketValue += inv.totalMarketValue || 0;
      existing.holdings.push(...inv.holdings);
      if (new Date(inv.lastUpdated) > new Date(existing.lastUpdated)) {
        existing.lastUpdated = inv.lastUpdated;
      }
    } else {
      const bankName = typeof inv.bankAccountId === 'object'
        ? (inv.bankAccountId as any).name
        : undefined;
      // Use portfolio-level cash balance from the Portfolio document
      const portfolioCash = portfolioCashBalances[key]?.cashBalance || 0;
      groups.set(key, {
        bankAccountId: key,
        accountName: bankName || inv.accountName || `Account ${inv.accountNumber}`,
        accountType: inv.accountType,
        currency: inv.currency,
        totalValue: (inv.totalValue || 0) + portfolioCash,
        totalMarketValue: inv.totalMarketValue || 0,
        cashBalance: portfolioCash,
        lastUpdated: inv.lastUpdated,
        holdings: [...inv.holdings]
      });
    }
  }

  return Array.from(groups.values());
}

interface GroupedAccountItemProps {
  account: GroupedAccount;
  holdingsPriceData: HoldingsPriceData;
}

const GroupedAccountItem: React.FC<GroupedAccountItemProps> = ({ account, holdingsPriceData }) => {
  const [expanded, setExpanded] = React.useState(false);
  const [selectedSymbol, setSelectedSymbol] = React.useState<string | null>(null);

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
            <Tooltip title={expanded ? 'Hide positions' : 'Show positions'}>
              <IconButton onClick={() => setExpanded(!expanded)} size="small">
                {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Positions Details */}
      {account.holdings.length > 0 && (
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Divider sx={{ my: 1 }} />
          <Box sx={{ px: 1, pb: 1 }}>
            {(() => {
              // Group holdings into positions: stock + linked options by underlying symbol
              const positions = new Map<string, { stock?: Holding; options: Holding[] }>();
              for (const h of account.holdings) {
                if (h.holdingType === 'option' && h.underlyingSymbol) {
                  const key = h.underlyingSymbol.toUpperCase();
                  if (!positions.has(key)) positions.set(key, { options: [] });
                  positions.get(key)!.options.push(h);
                } else {
                  const key = (h.symbol || '').toUpperCase();
                  if (!positions.has(key)) positions.set(key, { options: [] });
                  positions.get(key)!.stock = h;
                }
              }
              const positionCount = positions.size;
              const positionEntries: [string, { stock?: Holding; options: Holding[] }][] = [];
              positions.forEach((val, key) => positionEntries.push([key, val]));

              return (
                <>
                  <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                    Positions ({positionCount})
                  </Typography>
                  <Box sx={{ display: 'grid', gap: 1 }}>
                    {positionEntries.map(([posSymbol, position]) => {
                      const holding = position.stock || position.options[0];
                      const isStandaloneOption = !position.stock && position.options.length > 0;
                      const lookupSymbol = posSymbol;
                      const displaySymbol = posSymbol;

                      // Gain/loss from cost basis (stock only)
                      const mktValue = holding.marketValue || 0;
                      const costBasis = holding.costBasis;
                      const gainLoss = costBasis != null ? mktValue - costBasis : null;
                      const gainLossPercent = costBasis != null && costBasis !== 0
                        ? ((mktValue - costBasis) / Math.abs(costBasis)) * 100
                        : null;
                      const isGain = gainLoss != null && gainLoss >= 0;

                      // Daily price change
                      const priceData = holdingsPriceData[lookupSymbol];
                      const dailyChange = priceData?.change || 0;
                      const dailyChangePercent = priceData?.changePercent || 0;
                      const hasDailyChange = priceData != null && dailyChange !== 0;
                      const isDailyGain = dailyChange >= 0;

                      // Use market price from StockPrice service, not IBKR sync snapshot
                      const currentPrice = priceData?.price ?? holding.currentPrice;
                      const avgCost = costBasis != null && holding.quantity !== 0
                        ? Math.abs(costBasis) / Math.abs(holding.quantity)
                        : null;

                      const isSelected = selectedSymbol === lookupSymbol;

                      return (
                        <Box key={posSymbol}>
                          <Box
                            onClick={() => setSelectedSymbol(isSelected ? null : lookupSymbol)}
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              p: 1.5,
                              backgroundColor: isSelected ? 'action.selected' : 'grey.50',
                              borderRadius: position.options.length > 0 ? '4px 4px 0 0' : 1,
                              cursor: 'pointer',
                              '&:hover': { backgroundColor: 'action.hover' }
                            }}
                          >
                            {/* Left: Symbol, name, quantity */}
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {displaySymbol}
                                </Typography>
                                <Chip
                                  label={isStandaloneOption ? 'option' : 'stock'}
                                  size="small"
                                  variant="outlined"
                                  sx={{ height: 20, fontSize: '0.7rem' }}
                                />
                              </Box>
                              {holding.name && (
                                <Typography variant="caption" color="text.secondary">
                                  {holding.name}
                                </Typography>
                              )}
                              <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                                <Typography variant="caption">
                                  Qty: {Math.abs(holding.quantity).toLocaleString()}
                                </Typography>
                                {currentPrice != null && currentPrice > 0 && (
                                  <Typography variant="caption">
                                    Price: {formatCurrency(currentPrice, holding.currency || account.currency)}
                                  </Typography>
                                )}
                                {avgCost != null && (
                                  <Typography variant="caption" color="text.secondary">
                                    Avg Cost: {formatCurrency(avgCost, holding.currency || account.currency)}
                                  </Typography>
                                )}
                              </Box>
                            </Box>

                            {/* Center: Daily change */}
                            <Box sx={{ textAlign: 'center', minWidth: 100, px: 1 }}>
                              {hasDailyChange && (
                                <>
                                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                                    {isDailyGain
                                      ? <TrendingUpIcon sx={{ fontSize: 16, color: 'success.main' }} />
                                      : <TrendingDownIcon sx={{ fontSize: 16, color: 'error.main' }} />
                                    }
                                    <Typography
                                      variant="body2"
                                      sx={{ fontWeight: 600 }}
                                      color={isDailyGain ? 'success.main' : 'error.main'}
                                    >
                                      {dailyChangePercent >= 0 ? '+' : ''}{dailyChangePercent.toFixed(2)}%
                                    </Typography>
                                  </Box>
                                  <Typography variant="caption" color="text.secondary">
                                    {dailyChange >= 0 ? '+' : ''}{formatCurrency(dailyChange, account.currency)}
                                  </Typography>
                                </>
                              )}
                            </Box>

                            {/* Right: Market value + Gain/Loss */}
                            <Box sx={{ textAlign: 'right', minWidth: 120 }}>
                              {mktValue != null && (
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {formatCurrency(mktValue, holding.currency || account.currency)}
                                </Typography>
                              )}
                              {gainLoss != null && (
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                  {isGain
                                    ? <TrendingUpIcon sx={{ fontSize: 14, color: 'success.main' }} />
                                    : <TrendingDownIcon sx={{ fontSize: 14, color: 'error.main' }} />
                                  }
                                  <Typography
                                    variant="caption"
                                    color={isGain ? 'success.main' : 'error.main'}
                                    sx={{ fontWeight: 500 }}
                                  >
                                    {gainLoss >= 0 ? '+' : ''}{formatCurrency(gainLoss, account.currency)}
                                    {gainLossPercent != null && ` (${gainLossPercent >= 0 ? '+' : ''}${gainLossPercent.toFixed(1)}%)`}
                                  </Typography>
                                </Box>
                              )}
                              {costBasis != null && (
                                <Typography variant="caption" color="text.secondary">
                                  Cost: {formatCurrency(Math.abs(costBasis), holding.currency || account.currency)}
                                </Typography>
                              )}
                            </Box>
                          </Box>

                          {/* Linked options displayed under the stock */}
                          {position.options.length > 0 && position.stock && (
                            <Box sx={{
                              backgroundColor: 'grey.100',
                              borderRadius: '0 0 4px 4px',
                              borderTop: '1px dashed',
                              borderColor: 'divider',
                              px: 1.5,
                              py: 1
                            }}>
                              {position.options.map((opt, oi) => {
                                const isShort = opt.quantity < 0;
                                const formatExp = (dateStr?: string) => {
                                  if (!dateStr) return '';
                                  const d = new Date(dateStr);
                                  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
                                };
                                const optLabel = `${opt.putCall === 'CALL' ? 'Call' : 'Put'} ${formatCurrency(opt.strikePrice || 0, account.currency)} exp ${formatExp(opt.expirationDate)}`;

                                return (
                                  <Box key={`opt-${oi}`} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      {isShort && <Chip label="Short" size="small" color="warning" sx={{ height: 18, fontSize: '0.65rem' }} />}
                                      <Typography variant="caption" sx={{ fontWeight: 500 }}>
                                        {optLabel}
                                      </Typography>
                                    </Box>
                                    <Typography variant="caption" color="text.secondary">
                                      {Math.abs(opt.quantity)} contract{Math.abs(opt.quantity) !== 1 ? 's' : ''}
                                    </Typography>
                                  </Box>
                                );
                              })}
                            </Box>
                          )}

                          {/* Timeline chart for selected position */}
                          {isSelected && (
                            <Box sx={{ p: 1.5, pt: 0 }}>
                              <HoldingTimelineChart symbol={lookupSymbol} currency={account.currency} />
                            </Box>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                </>
              );
            })()}
          </Box>
        </Collapse>
      )}
    </ListItem>
  );
};

export const InvestmentAccountList: React.FC<InvestmentAccountListProps> = ({
  investments,
  portfolioCashBalances,
  holdingsPriceData,
  loading,
  onRefresh
}) => {
  const activeInvestments = investments.filter(inv => inv.status === 'active');
  const grouped = groupByBankAccount(activeInvestments, portfolioCashBalances);
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
                holdingsPriceData={holdingsPriceData}
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
