export const formatCurrency = (amount: number, currency: string = 'ILS'): string => {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency,
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
  
  const currencySymbol = currency === 'ILS' ? '₪' : currency;
  
  return `${isNegative ? '-' : ''}${formattedNumber} ${currencySymbol}`;
};

const formatters = {
  formatCurrency,
  formatCurrencyDisplay
};

export default formatters;
