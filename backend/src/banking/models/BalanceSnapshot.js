const mongoose = require('mongoose');

const balanceSnapshotSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bankAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankAccount',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  balance: {
    type: Number,
    required: true
  },
  availableBalance: {
    type: Number,
    default: null
  },
  currency: {
    type: String,
    required: true,
    default: 'ILS'
  },
  source: {
    type: String,
    enum: ['scraper', 'api'],
    required: true
  },
  dayChange: {
    type: Number,
    default: 0
  },
  dayChangePercent: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
balanceSnapshotSchema.index({ bankAccountId: 1, date: -1 });
balanceSnapshotSchema.index({ userId: 1, date: -1 });
balanceSnapshotSchema.index({ userId: 1, bankAccountId: 1, date: -1 }, { unique: true });
balanceSnapshotSchema.index({ date: -1 });

/**
 * Get balance history for a single bank account
 */
balanceSnapshotSchema.statics.getBalanceHistory = async function(bankAccountId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  return this.find({
    bankAccountId: new mongoose.Types.ObjectId(bankAccountId),
    date: { $gte: startDate }
  })
    .select('date balance availableBalance currency dayChange dayChangePercent')
    .sort({ date: 1 })
    .lean();
};

/**
 * Get the latest snapshot for each of a user's bank accounts
 */
balanceSnapshotSchema.statics.getLatestByUser = async function(userId) {
  return this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    { $sort: { date: -1 } },
    {
      $group: {
        _id: '$bankAccountId',
        snapshotId: { $first: '$_id' },
        date: { $first: '$date' },
        balance: { $first: '$balance' },
        availableBalance: { $first: '$availableBalance' },
        currency: { $first: '$currency' },
        dayChange: { $first: '$dayChange' },
        dayChangePercent: { $first: '$dayChangePercent' }
      }
    },
    {
      $project: {
        _id: '$snapshotId',
        bankAccountId: '$_id',
        date: 1,
        balance: 1,
        availableBalance: 1,
        currency: 1,
        dayChange: 1,
        dayChangePercent: 1
      }
    }
  ]);
};

/**
 * Get aggregated net worth history across all of a user's accounts.
 * Groups by date and sums balances (all converted to the same day).
 */
balanceSnapshotSchema.statics.getNetWorthHistory = async function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        date: { $gte: startDate }
      }
    },
    { $sort: { date: 1 } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
        totalBalance: { $sum: '$balance' },
        accountCount: { $sum: 1 },
        date: { $first: '$date' }
      }
    },
    { $sort: { date: 1 } },
    {
      $project: {
        _id: 0,
        date: '$date',
        dateString: '$_id',
        totalBalance: 1,
        accountCount: 1
      }
    }
  ]);
};

module.exports = mongoose.model('BalanceSnapshot', balanceSnapshotSchema);
