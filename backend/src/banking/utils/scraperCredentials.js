const ISRACARD_BANK_ID = 'isracard';
const AMEX_BANK_ID = 'amex';
const CARD6_DIGITS_BANK_IDS = new Set([ISRACARD_BANK_ID, AMEX_BANK_ID]);
const CARD6_DIGITS_PATTERN = /^\d{6}$/;

const requiresCard6Digits = (bankId) => CARD6_DIGITS_BANK_IDS.has(bankId);

const isValidCard6Digits = (value) =>
  typeof value === 'string' && CARD6_DIGITS_PATTERN.test(value);

const buildScraperCredentials = (bankId, { username, password, card6Digits }) => {
  if (requiresCard6Digits(bankId)) {
    return {
      id: username,
      card6Digits,
      password
    };
  }

  return { username, password };
};

module.exports = {
  AMEX_BANK_ID,
  ISRACARD_BANK_ID,
  buildScraperCredentials,
  isValidCard6Digits,
  requiresCard6Digits
};
