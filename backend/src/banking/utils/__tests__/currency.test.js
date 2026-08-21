const {
  currencyVariants,
  originalCurrencyOf,
  toCurrencySymbol,
  toIsoCurrency,
  transactionCurrencyDetails
} = require('../currency');

describe('currency utilities', () => {
  it('normalizes symbols and lowercase ISO codes', () => {
    expect(toIsoCurrency('€')).toBe('EUR');
    expect(toIsoCurrency('usd')).toBe('USD');
    expect(toIsoCurrency(null, 'ILS')).toBe('ILS');
    expect(toCurrencySymbol('EUR')).toBe('€');
  });

  it('expands ISO codes and symbols for database filters', () => {
    expect(currencyVariants(['EUR', '$'])).toEqual(
      expect.arrayContaining(['EUR', '€', '$', 'USD'])
    );
  });

  it('reads original and charged currency details from scraper data', () => {
    const transaction = {
      amount: -700,
      currency: 'ILS',
      rawData: {
        originalAmount: '-180',
        originalCurrency: '€',
        chargedCurrency: '₪'
      }
    };

    expect(transactionCurrencyDetails(transaction)).toEqual({
      chargedCurrency: 'ILS',
      originalCurrency: 'EUR',
      originalAmount: -180,
      isForeignCurrency: true
    });
    expect(originalCurrencyOf(transaction)).toBe('EUR');
  });
});
