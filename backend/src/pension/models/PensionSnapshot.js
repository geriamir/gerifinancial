const mongoose = require('mongoose');

const routeSnapshotSchema = new mongoose.Schema({
  name: { type: String, required: true },
  allocationPercent: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
  yieldPercent: { type: Number, default: null }
}, { _id: false });

const pensionSnapshotSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  pensionAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PensionAccount',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  totalBalance: {
    type: Number,
    required: true,
    default: 0
  },
  currency: {
    type: String,
    default: 'ILS'
  },
  routeBreakdown: [routeSnapshotSchema]
}, {
  timestamps: true
});

// One snapshot per account per day
pensionSnapshotSchema.index(
  { pensionAccountId: 1, date: 1 },
  { unique: true }
);
pensionSnapshotSchema.index({ userId: 1, date: -1 });
pensionSnapshotSchema.index({ pensionAccountId: 1, date: -1 });

// Static: get balance history for a pension account
pensionSnapshotSchema.statics.getHistory = function(pensionAccountId, startDate, endDate) {
  const query = { pensionAccountId };
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = startDate;
    if (endDate) query.date.$lte = endDate;
  }
  return this.find(query).sort({ date: 1 });
};

// Static: get aggregated balance history across all pension accounts for a user
pensionSnapshotSchema.statics.getUserHistory = async function(userId, days = 90) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  return this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), date: { $gte: startDate } } },
    {
      $group: {
        _id: '$date',
        totalBalance: { $sum: '$totalBalance' },
        accountCount: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        date: '$_id',
        totalBalance: 1,
        accountCount: 1
      }
    },
    { $sort: { date: 1 } }
  ]);
};

// Static: upsert a daily snapshot
pensionSnapshotSchema.statics.recordSnapshot = async function(data) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return this.findOneAndUpdate(
    { pensionAccountId: data.pensionAccountId, date: today },
    {
      $set: {
        userId: data.userId,
        totalBalance: data.totalBalance,
        currency: data.currency || 'ILS',
        routeBreakdown: data.routeBreakdown || []
      }
    },
    { upsert: true, new: true }
  );
};

module.exports = mongoose.model('PensionSnapshot', pensionSnapshotSchema);
