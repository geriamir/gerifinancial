const mongoose = require('mongoose');
const logger = require('../utils/logger');

const currencyExchangeSchema = new mongoose.Schema({
  fromCurrency: {
    type: String,
    required: true,
    uppercase: true,
    match: /^[A-Z]{3}$/
  },
  toCurrency: {
    type: String,
    required: true,
    uppercase: true,
    match: /^[A-Z]{3}$/
  },
  rate: {
    type: Number,
    required: true,
    min: 0
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  source: {
    type: String,
    enum: ['bank-of-israel', 'xe-api', 'manual', 'fixer-api'],
    default: 'bank-of-israel'
  },
  // Store additional metadata from the source
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Compound index for efficient currency pair lookups with date
currencyExchangeSchema.index({ 
  fromCurrency: 1, 
  toCurrency: 1, 
  date: -1 
}, { unique: true });

// Index for reverse lookup
currencyExchangeSchema.index({ 
  toCurrency: 1, 
  fromCurrency: 1, 
  date: -1 
});

// Static method to get exchange rate for a specific date
currencyExchangeSchema.statics.getRate = async function(fromCurrency, toCurrency, date = new Date()) {
  // If same currency, return rate of 1
  if (fromCurrency === toCurrency) {
    return 1;
  }

  // Try to find exact rate for the date
  let rate = await this.findOne({
    fromCurrency: fromCurrency.toUpperCase(),
    toCurrency: toCurrency.toUpperCase(),
    date: {
      $lte: date
    }
  }).sort({ date: -1 }).limit(1);

  if (rate) {
    return rate.rate;
  }

  // Try reverse rate (if we have USD->ILS, calculate ILS->USD)
  rate = await this.findOne({
    fromCurrency: toCurrency.toUpperCase(),
    toCurrency: fromCurrency.toUpperCase(),
    date: {
      $lte: date
    }
  }).sort({ date: -1 }).limit(1);

  if (rate) {
    return 1 / rate.rate; // Inverse rate
  }

  logger.warn(`No exchange rate found for ${fromCurrency} to ${toCurrency} on ${date}`);
  return null;
};

// Static method to convert amount between currencies
currencyExchangeSchema.statics.convertAmount = async function(amount, fromCurrency, toCurrency, date = new Date()) {
  const rate = await this.getRate(fromCurrency, toCurrency, date);
  
  if (rate === null) {
    throw new Error(`Cannot convert ${amount} from ${fromCurrency} to ${toCurrency}: no exchange rate available`);
  }

  return amount * rate;
};

// Static method to store/update exchange rate
currencyExchangeSchema.statics.updateRate = async function(fromCurrency, toCurrency, rate, date = new Date(), source = 'manual', metadata = {}) {
  const exchangeRate = await this.findOneAndUpdate(
    {
      fromCurrency: fromCurrency.toUpperCase(),
      toCurrency: toCurrency.toUpperCase(),
      date: new Date(date.getFullYear(), date.getMonth(), date.getDate()) // Store as date only, no time
    },
    {
      rate,
      source,
      metadata,
      updatedAt: new Date()
    },
    {
      upsert: true,
      new: true
    }
  );

  logger.info(`Updated exchange rate: ${fromCurrency}/${toCurrency} = ${rate} (${source})`);
  return exchangeRate;
};

// Static method to get latest rates for a currency
currencyExchangeSchema.statics.getLatestRates = async function(baseCurrency = 'ILS') {
  return this.aggregate([
    {
      $match: {
        $or: [
          { fromCurrency: baseCurrency.toUpperCase() },
          { toCurrency: baseCurrency.toUpperCase() }
        ]
      }
    },
    {
      $sort: { date: -1 }
    },
    {
      $group: {
        _id: {
          from: '$fromCurrency',
          to: '$toCurrency'
        },
        latestRate: { $first: '$rate' },
        date: { $first: '$date' },
        source: { $first: '$source' }
      }
    },
    {
      $project: {
        _id: 0,
        fromCurrency: '$_id.from',
        toCurrency: '$_id.to',
        rate: '$latestRate',
        date: '$date',
        source: '$source'
      }
    }
  ]);
};

// Virtual to get the currency pair string
currencyExchangeSchema.virtual('pair').get(function() {
  return `${this.fromCurrency}/${this.toCurrency}`;
});

// Method to get the inverse rate
currencyExchangeSchema.methods.getInverseRate = function() {
  return {
    fromCurrency: this.toCurrency,
    toCurrency: this.fromCurrency,
    rate: 1 / this.rate,
    date: this.date,
    source: this.source,
    pair: `${this.toCurrency}/${this.fromCurrency}`
  };
};

// Static method to seed common currency pairs
currencyExchangeSchema.statics.seedCommonRates = async function() {
  const today = new Date();
  
  // Default rates (approximate) - these should be updated with real data
  const defaultRates = [
    { from: 'USD', to: 'ILS', rate: 3.7 },
    { from: 'EUR', to: 'ILS', rate: 4.0 },
    { from: 'GBP', to: 'ILS', rate: 4.6 },
    { from: 'USD', to: 'EUR', rate: 0.85 },
    { from: 'GBP', to: 'USD', rate: 1.25 }
  ];

  for (const rateData of defaultRates) {
    await this.updateRate(
      rateData.from, 
      rateData.to, 
      rateData.rate, 
      today, 
      'manual', 
      { note: 'Default seed rate' }
    );
  }

  logger.info('Seeded common currency exchange rates');
};

module.exports = mongoose.model('CurrencyExchange', currencyExchangeSchema);
