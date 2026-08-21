const CURRENCY_SYMBOLS: Record<string, string> = {
  '₪': 'ILS',
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '¥': 'JPY',
};

export const normalizeCurrency = (
  currency?: string | null,
  fallback: string = 'ILS'
): string => {
  const raw = String(currency ?? '').trim();
  return raw ? (CURRENCY_SYMBOLS[raw] || raw.toUpperCase()) : fallback;
};

export const formatCurrency = (amount: number, currency: string = 'ILS'): string => {
  const normalizedCurrency = normalizeCurrency(currency);
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: normalizedCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

export const formatCurrencyDisplay = (amount: number, currency: string = 'ILS'): string => {
  // Custom formatting to ensure consistent spacing and alignment
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const formattedNumber = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(absAmount);
  
  const normalizedCurrency = normalizeCurrency(currency);
  const currencySymbol = normalizedCurrency === 'ILS' ? '₪' : normalizedCurrency;
  
  return `${isNegative ? '-' : ''}${formattedNumber} ${currencySymbol}`;
};

export const formatPercentage = (percentage: number): string => {
  const isNegative = percentage < 0;
  const absPercentage = Math.abs(percentage);
  const formatted = absPercentage.toFixed(2);
  return `${isNegative ? '-' : '+'}${formatted}%`;
};

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-US').format(num);
};

const formatters = {
  formatCurrency,
  formatCurrencyDisplay,
  normalizeCurrency,
  formatPercentage,
  formatNumber
};

export default formatters;
