const mongoose = require('mongoose');
const { PensionAccount, PensionSnapshot } = require('../models');
// Ensure BankAccount model is registered for populate calls
require('../../banking/models/BankAccount');

const userId = new mongoose.Types.ObjectId();
const bankAccountId = new mongoose.Types.ObjectId();

afterEach(async () => {
  await PensionAccount.deleteMany({});
  await PensionSnapshot.deleteMany({});
});

describe('PensionAccount Model', () => {
  test('should create a pension account with required fields', async () => {
    const account = await PensionAccount.create({
      userId,
      bankAccountId,
      provider: 'phoenix',
      productType: 'gemel',
      policyId: 'TEST-001',
      policyName: 'Test Gemel Fund'
    });

    expect(account.provider).toBe('phoenix');
    expect(account.productType).toBe('gemel');
    expect(account.policyId).toBe('TEST-001');
    expect(account.balance).toBe(0);
    expect(account.currency).toBe('ILS');
    expect(account.status).toBe('active');
  });

  test('should enforce unique policyId', async () => {
    // Ensure indexes are created
    await PensionAccount.ensureIndexes();
    
    await PensionAccount.create({
      userId, bankAccountId, provider: 'phoenix',
      productType: 'gemel', policyId: 'UNIQUE-001', policyName: 'Fund A'
    });

    await expect(PensionAccount.create({
      userId, bankAccountId, provider: 'phoenix',
      productType: 'hishtalmut', policyId: 'UNIQUE-001', policyName: 'Fund B'
    })).rejects.toThrow();
  });

  test('should store investment routes', async () => {
    const account = await PensionAccount.create({
      userId, bankAccountId, provider: 'phoenix',
      productType: 'gemel', policyId: 'ROUTES-001', policyName: 'Fund',
      investmentRoutes: [
        { name: 'S&P 500 Tracker', allocationPercent: 80, yieldPercent: 12.5, amount: 400000, isActive: true },
        { name: 'Bond Fund', allocationPercent: 20, yieldPercent: 3.2, amount: 100000, isActive: true }
      ]
    });

    expect(account.investmentRoutes).toHaveLength(2);
    expect(account.investmentRoutes[0].name).toBe('S&P 500 Tracker');
    expect(account.investmentRoutes[0].allocationPercent).toBe(80);
  });

  test('should store management fees', async () => {
    const account = await PensionAccount.create({
      userId, bankAccountId, provider: 'phoenix',
      productType: 'hishtalmut', policyId: 'FEE-001', policyName: 'Fund',
      managementFee: { fromDeposit: 4, fromSaving: 0.3, validUntil: new Date('2027-07-31') }
    });

    expect(account.managementFee.fromDeposit).toBe(4);
    expect(account.managementFee.fromSaving).toBe(0.3);
  });

  test('should store yearly transactions', async () => {
    const account = await PensionAccount.create({
      userId, bankAccountId, provider: 'phoenix',
      productType: 'gemel', policyId: 'YEARLY-001', policyName: 'Fund',
      yearlyTransactions: [{
        year: 2025,
        items: [
          { title: 'Opening Balance', amount: 500000 },
          { title: 'Deposits', amount: null },
          { title: 'Gains', amount: 14000 },
          { title: 'Fees', amount: -1600 }
        ]
      }]
    });

    expect(account.yearlyTransactions).toHaveLength(1);
    expect(account.yearlyTransactions[0].year).toBe(2025);
    expect(account.yearlyTransactions[0].items).toHaveLength(4);
  });

  test('findByUser should return active accounts', async () => {
    await PensionAccount.create([
      { userId, bankAccountId, provider: 'phoenix', productType: 'gemel', policyId: 'A1', policyName: 'Active', status: 'active', balance: 100000 },
      { userId, bankAccountId, provider: 'phoenix', productType: 'hishtalmut', policyId: 'A2', policyName: 'Closed', status: 'closed', balance: 0 }
    ]);

    const accounts = await PensionAccount.findByUser(userId);
    expect(accounts).toHaveLength(1);
    expect(accounts[0].policyName).toBe('Active');
  });

  test('findByUser should filter by productType', async () => {
    await PensionAccount.create([
      { userId, bankAccountId, provider: 'phoenix', productType: 'gemel', policyId: 'F1', policyName: 'Gemel', balance: 100 },
      { userId, bankAccountId, provider: 'phoenix', productType: 'hishtalmut', policyId: 'F2', policyName: 'Hishtalmut', balance: 200 }
    ]);

    const filtered = await PensionAccount.findByUser(userId, { productType: 'gemel' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].productType).toBe('gemel');
  });

  test('getSummary should group by product type', async () => {
    await PensionAccount.create([
      { userId, bankAccountId, provider: 'phoenix', productType: 'gemel', policyId: 'S1', policyName: 'Gemel A', balance: 300000, owner: 'Test Owner' },
      { userId, bankAccountId, provider: 'phoenix', productType: 'gemel', policyId: 'S2', policyName: 'Gemel B', balance: 200000, owner: 'Test Owner' },
      { userId, bankAccountId, provider: 'phoenix', productType: 'hishtalmut', policyId: 'S3', policyName: 'Hish A', balance: 500000 }
    ]);

    const summary = await PensionAccount.getSummary(userId);
    expect(summary).toHaveLength(2);

    const gemelGroup = summary.find(g => g.productType === 'gemel');
    expect(gemelGroup.totalBalance).toBe(500000);
    expect(gemelGroup.accountCount).toBe(2);
    expect(gemelGroup.accounts[0]).toHaveProperty('policyId');
    expect(gemelGroup.accounts[0]).toHaveProperty('owner', 'Test Owner');

    const hishGroup = summary.find(g => g.productType === 'hishtalmut');
    expect(hishGroup.totalBalance).toBe(500000);
    expect(hishGroup.accountCount).toBe(1);
    expect(hishGroup.accounts[0].policyId).toBe('S3');
    expect(hishGroup.accounts[0].owner).toBeNull();
  });
});

describe('PensionSnapshot Model', () => {
  test('should record a daily snapshot', async () => {
    const pensionAccountId = new mongoose.Types.ObjectId();

    const snapshot = await PensionSnapshot.recordSnapshot({
      userId,
      pensionAccountId,
      totalBalance: 536000,
      currency: 'ILS',
      routeBreakdown: [
        { name: 'S&P Tracker', allocationPercent: 100, amount: 536000, yieldPercent: -1.78 }
      ]
    });

    expect(snapshot.totalBalance).toBe(536000);
    expect(snapshot.routeBreakdown).toHaveLength(1);
  });

  test('should upsert same-day snapshot', async () => {
    const pensionAccountId = new mongoose.Types.ObjectId();

    await PensionSnapshot.recordSnapshot({
      userId, pensionAccountId, totalBalance: 500000
    });
    await PensionSnapshot.recordSnapshot({
      userId, pensionAccountId, totalBalance: 510000
    });

    const count = await PensionSnapshot.countDocuments({ pensionAccountId });
    expect(count).toBe(1);

    const snapshot = await PensionSnapshot.findOne({ pensionAccountId });
    expect(snapshot.totalBalance).toBe(510000);
  });

  test('getHistory should return ordered snapshots', async () => {
    const pensionAccountId = new mongoose.Types.ObjectId();

    const dates = [
      new Date('2026-01-01'),
      new Date('2026-01-15'),
      new Date('2026-02-01')
    ];

    for (const date of dates) {
      await PensionSnapshot.create({
        userId, pensionAccountId, date,
        totalBalance: 500000 + dates.indexOf(date) * 10000
      });
    }

    const history = await PensionSnapshot.getHistory(pensionAccountId, new Date('2026-01-01'));
    expect(history).toHaveLength(3);
    expect(history[0].totalBalance).toBe(500000);
    expect(history[2].totalBalance).toBe(520000);
  });
});

describe('PensionService', () => {
  const pensionService = require('../services/pensionService');

  test('processAllProducts should create accounts from Phoenix data', async () => {
    const allProducts = {
      gemel: [
        { policyNumber: 'G-001', policyName: 'קופת גמל', totalSaving: { value: 536000, currency: '₪' } }
      ],
      hishtalmut: [
        { policyNumber: 'H-001', policyName: 'קרן השתלמות', totalSaving: { value: 200000, currency: '₪' } }
      ],
      health: [
        { policyNumber: 'HE-001', policyName: 'ביטוח בריאות', totalSaving: { value: 0, currency: '₪' } }
      ]
    };

    const results = await pensionService.processAllProducts(allProducts, userId, bankAccountId);
    expect(results.synced).toBe(3);
    expect(results.errors).toHaveLength(0);

    const accounts = await PensionAccount.find({ userId });
    expect(accounts).toHaveLength(3);

    const gemel = accounts.find(a => a.policyId === 'G-001');
    expect(gemel.productType).toBe('gemel');
    expect(gemel.balance).toBe(536000);
    expect(gemel.currency).toBe('ILS');
  });

  test('processAllProducts should upsert existing accounts', async () => {
    const products = {
      gemel: [{ policyNumber: 'UP-001', policyName: 'Fund', totalSaving: { value: 100000, currency: '₪' } }]
    };

    await pensionService.processAllProducts(products, userId, bankAccountId);

    // Update balance
    products.gemel[0].totalSaving.value = 110000;
    await pensionService.processAllProducts(products, userId, bankAccountId);

    const accounts = await PensionAccount.find({ policyId: 'UP-001' });
    expect(accounts).toHaveLength(1);
    expect(accounts[0].balance).toBe(110000);
  });

  test('processAccountDetail should update investment routes and fees', async () => {
    // Create account first
    await PensionAccount.create({
      userId, bankAccountId, provider: 'phoenix',
      productType: 'gemel', policyId: 'DET-001', policyName: 'Fund', balance: 500000
    });

    const detail = {
      accountTransactions: {
        totalSum: { value: 536000, currency: '₪' },
        list: [{
          year: '2026',
          updateDate: '28.02.2026',
          list: [
            { title: 'Opening Balance', subTitle: 'Start', sum: { value: 560000, currency: '₪' } },
            { title: 'Losses', subTitle: 'Net', sum: { value: -9000, currency: '₪' } },
            { title: 'Fees', subTitle: 'Annual', sum: { value: -275, currency: '₪' } }
          ]
        }]
      },
      investmentRoutesTransferConcentration: {
        investmentRoutes: {
          list: [{
            investmentRouteTitle: 'S&P 500 Tracker',
            investmentPercent: { value: 100 },
            yieldPercentage: { value: -1.78 },
            investmentSum: { value: 536000, currency: '₪' },
            updateDate: '17.03.2026',
            isExistRoute: true
          }]
        }
      },
      managementFee: {
        percentageMngFee: {
          fromDeposit: { percentageData: { value: 4 } },
          fromSaving: { percentageData: { value: 0.3 } }
        },
        updatedMngFee: {
          fromSaving: {
            popupData: {
              list: [{ fromSaving: { value: 0.3 }, dateTo: '31.07.2027' }]
            }
          }
        }
      },
      expectedPayments: {
        list: [{ title: 'Annuity Amount', subTitle: 'For retirement', sum: { value: 551000, currency: '₪' } }]
      },
      noticeUpdate: {
        generalDetails: {
          startDate: '17.07.2019',
          employerName: 'ACME Corp',
          oldAccountNumber: '014-00294188'
        }
      }
    };

    const updated = await pensionService.processAccountDetail(detail, 'DET-001', userId);

    expect(updated.balance).toBe(536000);
    expect(updated.investmentRoutes).toHaveLength(1);
    expect(updated.investmentRoutes[0].name).toBe('S&P 500 Tracker');
    expect(updated.investmentRoutes[0].allocationPercent).toBe(100);
    expect(updated.managementFee.fromDeposit).toBe(4);
    expect(updated.managementFee.fromSaving).toBe(0.3);
    expect(updated.yearlyTransactions).toHaveLength(1);
    expect(updated.yearlyTransactions[0].items).toHaveLength(3);
    expect(updated.expectedPayments).toHaveLength(1);
    expect(updated.employerName).toBe('ACME Corp');
    expect(updated.accountNumber).toBe('014-00294188');
  });

  test('processAllProducts should skip non-array categories', async () => {
    const products = {
      gemel: [{ policyNumber: 'SK-001', policyName: 'Fund', totalSaving: { value: 100, currency: '₪' } }],
      unknownField: 'not an array',
      anotherField: null
    };

    const results = await pensionService.processAllProducts(products, userId, bankAccountId);
    expect(results.synced).toBe(1);
  });
});
