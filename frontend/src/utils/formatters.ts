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
  formatCurrencyDisplay
};

export default formatters;
