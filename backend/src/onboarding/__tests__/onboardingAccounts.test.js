const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const { User } = require('../../auth');
const { BankAccount } = require('../../banking');
const scrapingEvents = require('../../banking/services/scrapingEvents');

// Mock the banking module
jest.mock('../../banking', () => {
  const actual = jest.requireActual('../../banking');
  return {
    ...actual,
    bankAccountService: {
      create: jest.fn()
    }
  };
});
const { bankAccountService } = require('../../banking');

describe('Onboarding Accounts API', () => {
  let authToken;
  let testUser;

  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gerifinancial-test', {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
    }
  });

  beforeEach(async () => {
    // Clear collections
    await User.deleteMany({});
    await BankAccount.deleteMany({});

    // Create test user
    testUser = await User.create({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User'
    });

    // Get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('POST /api/onboarding/checking-account', () => {
    it('should add checking account and update onboarding structure', async () => {
      // Mock bank account service
      const mockAccount = {
        _id: new mongoose.Types.ObjectId(),
        userId: testUser._id,
        bankId: 'hapoalim',
        accountType: 'checking',
        displayName: 'My Checking',
        isActive: true
      };

      bankAccountService.create.mockResolvedValue(mockAccount);

      const response = await request(app)
        .post('/api/onboarding/checking-account')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bankId: 'hapoalim',
          credentials: {
            username: 'user123',
            password: 'pass123'
          },
          displayName: 'My Checking'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.account).toBeDefined();
      expect(response.body.data.onboardingStep).toBe('transaction-import');

      // Verify onboarding structure was updated
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.onboarding.startedAt).toBeDefined();
      expect(updatedUser.onboarding.checkingAccount.connected).toBe(true);
      expect(updatedUser.onboarding.checkingAccount.accountId.toString()).toBe(mockAccount._id.toString());
      expect(updatedUser.onboarding.checkingAccount.bankId).toBe('hapoalim');
      expect(updatedUser.onboarding.currentStep).toBe('transaction-import');
      expect(updatedUser.onboarding.completedSteps).toContain('checking-account');
    });

    it('should return 400 if bankId is missing', async () => {
      const response = await request(app)
        .post('/api/onboarding/checking-account')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          credentials: {
            username: 'user123',
            password: 'pass123'
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .post('/api/onboarding/checking-account')
        .send({
          bankId: 'hapoalim',
          credentials: {
            username: 'user123',
            password: 'pass123'
          }
        });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/onboarding/credit-card-account', () => {
    beforeEach(async () => {
      // Set up user with checking account already added
      testUser.onboarding = {
        startedAt: new Date(),
        currentStep: 'credit-card-setup',
        checkingAccount: {
          connected: true,
          accountId: new mongoose.Types.ObjectId(),
          connectedAt: new Date(),
          bankId: 'hapoalim'
        },
        transactionImport: {
          completed: true,
          transactionsImported: 100,
          completedAt: new Date()
        },
        creditCardDetection: {
          analyzed: true,
          analyzedAt: new Date(),
          transactionCount: 10,
          recommendation: 'connect'
        },
        completedSteps: ['checking-account', 'transaction-import', 'credit-card-detection']
      };
      await testUser.save();
    });

    it('should add credit card account and update onboarding structure', async () => {
      const mockAccount = {
        _id: new mongoose.Types.ObjectId(),
        userId: testUser._id,
        bankId: 'isracard',
        accountType: 'creditCard',
        displayName: 'Isracard',
        isActive: true
      };

      bankAccountService.create.mockResolvedValue(mockAccount);

      const response = await request(app)
        .post('/api/onboarding/credit-card-account')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bankId: 'isracard',
          credentials: {
            username: 'user123',
            password: 'pass123'
          },
          displayName: 'Isracard'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.onboardingStep).toBe('credit-card-matching');

      // Verify onboarding structure was updated
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.onboarding.creditCardSetup.creditCardAccounts).toHaveLength(1);
      expect(updatedUser.onboarding.creditCardSetup.creditCardAccounts[0].accountId.toString())
        .toBe(mockAccount._id.toString());
      expect(updatedUser.onboarding.creditCardSetup.creditCardAccounts[0].bankId).toBe('isracard');
      expect(updatedUser.onboarding.currentStep).toBe('credit-card-matching');
    });

    it('should allow adding multiple credit card accounts', async () => {
      const mockAccount1 = {
        _id: new mongoose.Types.ObjectId(),
        userId: testUser._id,
        bankId: 'isracard',
        accountType: 'creditCard',
        displayName: 'Isracard',
        isActive: true
      };

      const mockAccount2 = {
        _id: new mongoose.Types.ObjectId(),
        userId: testUser._id,
        bankId: 'max',
        accountType: 'creditCard',
        displayName: 'Max',
        isActive: true
      };

      bankAccountService.create
        .mockResolvedValueOnce(mockAccount1)
        .mockResolvedValueOnce(mockAccount2);

      // Add first card
      await request(app)
        .post('/api/onboarding/credit-card-account')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bankId: 'isracard',
          credentials: { username: 'user123', password: 'pass123' }
        });

      // Add second card
      await request(app)
        .post('/api/onboarding/credit-card-account')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bankId: 'max',
          credentials: { username: 'user456', password: 'pass456' }
        });

      // Verify both were added
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.onboarding.creditCardSetup.creditCardAccounts).toHaveLength(2);
    });
  });

  describe('POST /api/onboarding/skip-credit-cards', () => {
    beforeEach(async () => {
      // Set up user with checking account and detection complete
      testUser.onboarding = {
        startedAt: new Date(),
        currentStep: 'credit-card-setup',
        checkingAccount: {
          connected: true,
          accountId: new mongoose.Types.ObjectId(),
          connectedAt: new Date(),
          bankId: 'hapoalim'
        },
        transactionImport: {
          completed: true,
          transactionsImported: 100,
          completedAt: new Date()
        },
        creditCardDetection: {
          analyzed: true,
          analyzedAt: new Date(),
          transactionCount: 5,
          recommendation: 'optional'
        },
        completedSteps: ['checking-account', 'transaction-import', 'credit-card-detection']
      };
      await testUser.save();
    });

    it('should skip credit cards and complete onboarding', async () => {
      const response = await request(app)
        .post('/api/onboarding/skip-credit-cards')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.onboardingComplete).toBe(true);
      expect(response.body.data.creditCardsSkipped).toBe(true);

      // Verify onboarding structure was updated
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.onboarding.creditCardSetup.skipped).toBe(true);
      expect(updatedUser.onboarding.creditCardSetup.skippedAt).toBeDefined();
      expect(updatedUser.onboarding.currentStep).toBe('complete');
      expect(updatedUser.onboarding.isComplete).toBe(true);
      expect(updatedUser.onboarding.completedAt).toBeDefined();
      expect(updatedUser.onboarding.completedSteps).toContain('credit-card-setup');
    });
  });

  describe('GET /api/onboarding/status', () => {
    it('should return complete onboarding status', async () => {
      // Set up comprehensive onboarding state
      const checkingAccountId = new mongoose.Types.ObjectId();
      const creditCardAccountId = new mongoose.Types.ObjectId();

      // Create actual accounts for population
      const checkingAccount = await BankAccount.create({
        _id: checkingAccountId,
        userId: testUser._id,
        bankId: 'hapoalim',
        accountType: 'checking',
        name: 'My Checking',
        displayName: 'My Checking',
        isActive: true,
        credentials: {
          username: 'testuser',
          password: 'testpass'
        }
      });

      const creditCardAccount = await BankAccount.create({
        _id: creditCardAccountId,
        userId: testUser._id,
        bankId: 'isracard',
        accountType: 'creditCard',
        name: 'Isracard',
        displayName: 'Isracard',
        isActive: true,
        credentials: {
          username: 'testuser',
          password: 'testpass'
        }
      });

      testUser.onboarding = {
        isComplete: false,
        currentStep: 'credit-card-matching',
        startedAt: new Date('2025-10-03T20:00:00.000Z'),
        checkingAccount: {
          connected: true,
          accountId: checkingAccountId,
          connectedAt: new Date('2025-10-03T20:00:00.000Z'),
          bankId: 'hapoalim'
        },
        transactionImport: {
          completed: true,
          transactionsImported: 150,
          completedAt: new Date('2025-10-03T20:05:00.000Z')
        },
        creditCardDetection: {
          analyzed: true,
          analyzedAt: new Date('2025-10-03T20:05:30.000Z'),
          transactionCount: 12,
          recommendation: 'connect',
          sampleTransactions: [
            {
              date: new Date('2025-09-15'),
              description: 'Credit Card Payment',
              amount: 2500
            }
          ]
        },
        creditCardSetup: {
          skipped: false,
          creditCardAccounts: [{
            accountId: creditCardAccountId,
            connectedAt: new Date('2025-10-03T20:10:00.000Z'),
            bankId: 'isracard',
            displayName: 'Isracard'
          }]
        },
        creditCardMatching: {
          completed: false,
          totalCreditCardPayments: 0,
          coveredPayments: 0,
          uncoveredPayments: 0,
          coveragePercentage: 0,
          matchedPayments: []
        },
        completedSteps: ['checking-account', 'transaction-import', 'credit-card-detection']
      };
      await testUser.save();

      const response = await request(app)
        .get('/api/onboarding/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const { data } = response.body;
      expect(data.currentStep).toBe('credit-card-matching');
      expect(data.isComplete).toBe(false);
      expect(data.checkingAccount.connected).toBe(true);
      expect(data.checkingAccount.accountId._id).toBe(checkingAccountId.toString());
      expect(data.transactionImport.completed).toBe(true);
      expect(data.transactionImport.transactionsImported).toBe(150);
      expect(data.creditCardDetection.analyzed).toBe(true);
      expect(data.creditCardDetection.recommendation).toBe('connect');
      expect(data.creditCardSetup.creditCardAccounts).toHaveLength(1);
      expect(data.completedSteps).toHaveLength(3);
    });

    it('should return empty onboarding for new user', async () => {
      const response = await request(app)
        .get('/api/onboarding/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const { data } = response.body;
      expect(data.currentStep).toBe('checking-account');
      expect(data.isComplete).toBe(false);
    });
  });
});
