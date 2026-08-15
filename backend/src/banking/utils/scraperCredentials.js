const ISRACARD_BANK_ID = 'isracard';
const CARD6_DIGITS_PATTERN = /^\d{6}$/;

const isValidCard6Digits = (value) =>
  typeof value === 'string' && CARD6_DIGITS_PATTERN.test(value);

const buildScraperCredentials = (bankId, { username, password, card6Digits }) => {
  if (bankId === ISRACARD_BANK_ID) {
    return {
      id: username,
      card6Digits,
      password
    };
  }

  return { username, password };
};

module.exports = {
  ISRACARD_BANK_ID,
  buildScraperCredentials,
  isValidCard6Digits
};
