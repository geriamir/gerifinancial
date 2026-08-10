const CARD_PAYMENT_DESCRIPTION_PATTERN =
  /^\s*(?:כרטיסי?\s*אשראי|ישראכרט(?:\s+בע"?מ)?|דיינרס(?:\s*קלוב)?|ויזה\s*כאל|מקס\s*(?:איט\s*)?פיננסים|כאל|מקס|credit\s*card(?:\s+payment)?)(?:\s*-\s*י)?\s*$/i;

const likelyPaymentTextQuery = () => ({
  amount: { $lt: 0 },
  $or: [
    { description: CARD_PAYMENT_DESCRIPTION_PATTERN },
    { memo: CARD_PAYMENT_DESCRIPTION_PATTERN },
    { 'rawData.description': CARD_PAYMENT_DESCRIPTION_PATTERN },
    { 'rawData.memo': CARD_PAYMENT_DESCRIPTION_PATTERN }
  ]
});

const isLikelyCreditCardPayment = transaction =>
  transaction?.amount < 0 &&
  [
    transaction.description,
    transaction.memo,
    transaction.rawData?.description,
    transaction.rawData?.memo
  ].some(value => typeof value === 'string' && CARD_PAYMENT_DESCRIPTION_PATTERN.test(value));

const creditCardPaymentMatchStage = () => ({
  $match: {
    $or: [
      {
        categoryDetails: {
          $elemMatch: {
            name: 'Credit Card',
            type: 'Transfer'
          }
        }
      },
      likelyPaymentTextQuery()
    ]
  }
});

module.exports = {
  CARD_PAYMENT_DESCRIPTION_PATTERN,
  likelyPaymentTextQuery,
  isLikelyCreditCardPayment,
  creditCardPaymentMatchStage
};
