const mongoose = require('mongoose');

const investmentRouteSchema = new mongoose.Schema({
  name: { type: String, required: true },
  allocationPercent: { type: Number, default: 0 },
  yieldPercent: { type: Number, default: null },
  amount: { type: Number, default: 0 },
  currency: { type: String, default: 'ILS' },
  updateDate: { type: Date, default: null },
  isActive: { type: Boolean, default: true }
}, { _id: false });

const yearlyTransactionItemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subTitle: { type: String, default: null },
  amount: { type: Number, default: null },
  currency: { type: String, default: 'ILS' }
}, { _id: false });

const yearlyTransactionSchema = new mongoose.Schema({
  year: { type: Number, required: true },
  updateDate: { type: Date, default: null },
  items: [yearlyTransactionItemSchema]
}, { _id: false });

const expectedPaymentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subTitle: { type: String, default: null },
  amount: { type: Number, default: null },
  currency: { type: String, default: 'ILS' }
}, { _id: false });

const pensionAccountSchema = new mongoose.Schema({
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
  provider: {
    type: String,
    required: true,
    enum: ['phoenix', 'migdal', 'harel', 'menora', 'clal', 'other'],
    default: 'phoenix'
  },
  productType: {
    type: String,
    required: true,
    enum: ['gemel', 'hishtalmut', 'pension', 'lifeSaving', 'pizuim', 'health', 'life', 'other']
  },
  policyId: {
    type: String,
    required: true
  },
  policyName: {
    type: String,
    required: true
  },
  policyNickname: {
    type: String,
    default: null
  },
  accountNumber: {
    type: String,
    default: null
  },
  balance: {
    type: Number,
    required: true,
    default: 0
  },
  currency: {
    type: String,
    default: 'ILS'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'closed'],
    default: 'active'
  },
  owner: {
    type: String,
    default: null
  },
  employerName: {
    type: String,
    default: null
  },
  startDate: {
    type: Date,
    default: null
  },
  investmentRoutes: [investmentRouteSchema],
  managementFee: {
    fromDeposit: { type: Number, default: null },
    fromSaving: { type: Number, default: null },
    validUntil: { type: Date, default: null }
  },
  yearlyTransactions: [yearlyTransactionSchema],
  expectedPayments: [expectedPaymentSchema],
  lastSynced: {
    type: Date,
    default: null
  },
  rawData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
pensionAccountSchema.index({ userId: 1, provider: 1 });
pensionAccountSchema.index({ userId: 1, productType: 1 });
pensionAccountSchema.index({ userId: 1, bankAccountId: 1 });
pensionAccountSchema.index({ userId: 1, policyId: 1 }, { unique: true });

// Static: find all pension accounts for a user
pensionAccountSchema.statics.findByUser = function(userId, options = {}) {
  const query = { userId, status: { $ne: 'closed' } };
  if (options.productType) query.productType = options.productType;
  if (options.provider) query.provider = options.provider;
  return this.find(query)
    .populate('bankAccountId', 'name bankId')
    .sort({ productType: 1, policyName: 1 });
};

// Static: get summary totals grouped by product type
pensionAccountSchema.statics.getSummary = async function(userId) {
  const pipeline = [
    { $match: { userId: new mongoose.Types.ObjectId(userId), status: { $ne: 'closed' } } },
    {
      $group: {
        _id: '$productType',
        totalBalance: { $sum: '$balance' },
        accountCount: { $sum: 1 },
        accounts: {
          $push: {
            _id: '$_id',
            policyId: '$policyId',
            policyName: '$policyName',
            balance: '$balance',
            provider: '$provider',
            owner: '$owner',
            employerName: '$employerName'
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        productType: '$_id',
        totalBalance: 1,
        accountCount: 1,
        accounts: 1
      }
    },
    { $sort: { totalBalance: -1 } }
  ];
  return this.aggregate(pipeline);
};

module.exports = mongoose.model('PensionAccount', pensionAccountSchema);
