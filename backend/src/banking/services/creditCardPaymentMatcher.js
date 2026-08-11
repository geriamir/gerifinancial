const CARD_PAYMENT_DESCRIPTION_PATTERN =
  /^\s*(?:כרטיסי?\s*אשראי|ישראכרט(?:\s+בע"?מ)?|דיינרס(?:\s*קלוב)?|ויזה\s*כאל|מקס\s*(?:איט\s*)?פיננסים|כאל|מקס|credit\s*card(?:\s+payment)?|isracard(?:\s+monthly\s+payment)?|diners(?:\s+club)?(?:\s+monthly\s+payment)?|visa\s*cal(?:\s+monthly\s+payment)?|(?:cal|max)\s+monthly\s+payment)(?:\s*-\s*י)?\s*$/i;

const CREDIT_CARD_PROVIDER_HINTS = [
  { bankId: 'isracard', pattern: /ישראכרט|\bisracard\b/i },
  { bankId: 'visaCal', pattern: /דיינרס|ויזה\s*כאל|^\s*כאל(?:\s*-\s*י)?\s*$|\bdiners(?:\s+club)?\b|\bvisa\s*cal\b|\bcal\s+monthly\s+payment\b/i },
  { bankId: 'max', pattern: /מקס\s*(?:איט\s*)?פיננסים|^\s*מקס(?:\s*-\s*י)?\s*$|\bmax\s+monthly\s+payment\b/i }
];

const paymentTextValues = transaction => [
  transaction?.description,
  transaction?.memo,
  transaction?.rawDescription,
  transaction?.rawMemo,
  transaction?.rawData?.description,
  transaction?.rawData?.memo
].filter(value => typeof value === 'string');

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
  paymentTextValues(transaction)
    .some(value => CARD_PAYMENT_DESCRIPTION_PATTERN.test(value));

const inferCreditCardProvider = transaction => {
  const textValues = paymentTextValues(transaction);
  return CREDIT_CARD_PROVIDER_HINTS.find(
    hint => textValues.some(value => hint.pattern.test(value))
  )?.bankId || null;
};

const suggestCreditCardProviders = transactions => {
  const counts = new Map();

  for (const transaction of transactions || []) {
    const bankId = inferCreditCardProvider(transaction);
    if (bankId) counts.set(bankId, (counts.get(bankId) || 0) + 1);
  }

  return CREDIT_CARD_PROVIDER_HINTS
    .map((hint, order) => ({
      bankId: hint.bankId,
      paymentCount: counts.get(hint.bankId) || 0,
      order
    }))
    .filter(suggestion => suggestion.paymentCount > 0)
    .sort((left, right) =>
      right.paymentCount - left.paymentCount || left.order - right.order
    )
    .map(({ bankId, paymentCount }) => ({ bankId, paymentCount }));
};

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
  inferCreditCardProvider,
  suggestCreditCardProviders,
  creditCardPaymentMatchStage
};
