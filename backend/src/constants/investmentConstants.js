// Investment-related constants
const INVESTMENT_CONSTANTS = {
  FALLBACK_SYMBOLS: {
    UNKNOWN_SYMBOL: null, // Use null instead of magic string for better data analysis
    PLACEHOLDER_NAME: 'Unknown Investment'
  },
  ACCOUNT_TYPES: {
    INVESTMENT: 'investment',
    PENSION: 'pension',
    SAVINGS: 'savings',
    PORTFOLIO: 'portfolio',
    OTHER: 'other'
  },
  HOLDING_TYPES: {
    STOCK: 'stock',
    BOND: 'bond',
    ETF: 'etf',
    MUTUAL_FUND: 'mutual_fund',
    OTHER: 'other'
  },
  STATUS_TYPES: {
    ACTIVE: 'active',
    CLOSED: 'closed',
    SUSPENDED: 'suspended'
  },
  DEFAULT_CURRENCY: 'ILS'
};

module.exports = INVESTMENT_CONSTANTS;
