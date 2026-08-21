const SYMBOL_TO_ISO = Object.freeze({
  '₪': 'ILS',
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '¥': 'JPY'
});

const ISO_TO_SYMBOL = Object.freeze(
  Object.fromEntries(Object.entries(SYMBOL_TO_ISO).map(([symbol, iso]) => [iso, symbol]))
);

const toIsoCurrency = (value, fallback = null) => {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  return SYMBOL_TO_ISO[raw] || raw.toUpperCase();
};

const toCurrencySymbol = (value, fallback = null) => {
  const iso = toIsoCurrency(value);
  return (iso && ISO_TO_SYMBOL[iso]) || fallback;
};

const currencyVariants = (values) => {
  const variants = new Set();

  for (const value of values || []) {
    const raw = String(value ?? '').trim();
    if (!raw) continue;

    const iso = toIsoCurrency(raw);
    variants.add(raw);
    if (iso) variants.add(iso);
    if (iso && ISO_TO_SYMBOL[iso]) variants.add(ISO_TO_SYMBOL[iso]);
  }

  return [...variants];
};

const finiteAmount = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
};

const transactionCurrencyDetails = (transaction) => {
  const chargedCurrency =
    toIsoCurrency(transaction?.rawData?.chargedCurrency) ||
    toIsoCurrency(transaction?.currency) ||
    'ILS';
  const originalCurrency =
    toIsoCurrency(transaction?.rawData?.originalCurrency) ||
    chargedCurrency;

  return {
    chargedCurrency,
    originalCurrency,
    originalAmount: finiteAmount(transaction?.rawData?.originalAmount),
    isForeignCurrency: originalCurrency !== 'ILS'
  };
};

const originalCurrencyOf = (transaction) =>
  transactionCurrencyDetails(transaction).originalCurrency;

module.exports = {
  currencyVariants,
  originalCurrencyOf,
  toCurrencySymbol,
  toIsoCurrency,
  transactionCurrencyDetails
};
