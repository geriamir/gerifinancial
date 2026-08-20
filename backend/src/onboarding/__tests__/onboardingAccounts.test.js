const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const config = require('../../shared/config');
const { User } = require('../../auth');
const { BankAccount, Transaction, Category } = require('../../banking');
const scrapingEvents = require('../../banking/services/scrapingEvents');

// Mock the banking module
jest.mock('../../banking', () => {
  const actual = jest.requireActual('../../banking');
  return {
    ...actual,
    bankAccountService: {
      create: jest.fn(),
      updateCredentials: jest.fn(),
      delete: jest.fn()
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
    await Transaction.deleteMany({});
    await Category.deleteMany({});

    // Create test user
    testUser = await User.create({
      email: 'test@example.com',
      githubId: 90401,
      githubLogin: 'test-user',
      name: 'Test User'
    });

    // Sign the session directly: login goes through GitHub now, which this
    // suite has no reason to exercise.
    authToken = jwt.sign({ userId: testUser._id }, config.jwtSecret, {
      expiresIn: config.jwtExpiration
    });
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
            password: 'pass123',
            card6Digits: '123456'
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
            password: 'pass123',
            card6Digits: '123456'
          },
          displayName: 'Isracard'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.onboardingStep).toBe('credit-card-matching');
      expect(bankAccountService.create).toHaveBeenCalledWith(
        testUser._id,
        expect.objectContaining({
          name: 'Isracard',
          card6Digits: '123456'
        }),
        { deferCredentialValidation: true }
      );

      // Verify onboarding structure was updated
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.onboarding.creditCardSetup.creditCardAccounts).toHaveLength(1);
      expect(updatedUser.onboarding.creditCardSetup.creditCardAccounts[0].accountId.toString())
        .toBe(mockAccount._id.toString());
      expect(updatedUser.onboarding.creditCardSetup.creditCardAccounts[0].bankId).toBe('isracard');
      expect(updatedUser.onboarding.creditCardSetup.creditCardAccounts[0].displayName).toBe('Isracard');
      expect(updatedUser.onboarding.currentStep).toBe('credit-card-matching');
      expect(updatedUser.onboarding.creditCardMatching.completed).toBe(false);
      expect(updatedUser.onboarding.creditCardMatching.processingAccountId.toString())
        .toBe(mockAccount._id.toString());
      expect(updatedUser.onboarding.creditCardMatching.error).toBeNull();
    });

    it('should add an American Express account with last-six credentials', async () => {
      const mockAccount = {
        _id: new mongoose.Types.ObjectId(),
        userId: testUser._id,
        bankId: 'amex',
        accountType: 'creditCard',
        displayName: 'American Express',
        isActive: true
      };
      bankAccountService.create.mockResolvedValue(mockAccount);

      const response = await request(app)
        .post('/api/onboarding/credit-card-account')
        .set('Authorization', 'Bearer ' + authToken)
        .send({
          bankId: 'amex',
          credentials: {
            username: 'user123',
            password: 'pass123',
            card6Digits: '654321'
          },
          displayName: 'American Express'
        });

      expect(response.status).toBe(200);
      expect(bankAccountService.create).toHaveBeenCalledWith(
        testUser._id,
        expect.objectContaining({
          bankId: 'amex',
          card6Digits: '654321'
        }),
        { deferCredentialValidation: true }
      );
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.onboarding.creditCardSetup.creditCardAccounts[0].bankId).toBe('amex');
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
          credentials: { username: 'user123', password: 'pass123', card6Digits: '123456' },
          displayName: 'Personal Isracard'
        });

      // Add second card
      await request(app)
        .post('/api/onboarding/credit-card-account')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bankId: 'max',
          credentials: { username: 'user456', password: 'pass456' },
          displayName: 'Family Max'
        });

      // Verify both were added
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.onboarding.creditCardSetup.creditCardAccounts).toHaveLength(2);
    });

    it('requires a name for each credit card account', async () => {
      const response = await request(app)
        .post('/api/onboarding/credit-card-account')
        .set('Authorization', 'Bearer ' + authToken)
        .send({
          bankId: 'visaCal',
          credentials: {
            username: 'user123',
            password: 'pass123'
          },
          displayName: '   '
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Account name, bank ID and credentials are required');
      expect(bankAccountService.create).not.toHaveBeenCalled();
    });

    it.each([
      ['isracard', 'Personal Isracard'],
      ['amex', 'Personal American Express']
    ])('should reject %s without exactly six card digits', async (bankId, displayName) => {
      const response = await request(app)
        .post('/api/onboarding/credit-card-account')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bankId,
          credentials: {
            username: 'user123',
            password: 'pass123',
            card6Digits: '12345'
          },
          displayName
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Last 6 card digits must be exactly 6 digits');
      expect(bankAccountService.create).not.toHaveBeenCalled();
    });
  });

  describe('failed onboarding credit card actions', () => {
    let failedAccountId;

    beforeEach(async () => {
      failedAccountId = new mongoose.Types.ObjectId();
      testUser.onboarding = {
        startedAt: new Date(),
        currentStep: 'credit-card-matching',
        isComplete: false,
        creditCardSetup: {
          skipped: false,
          creditCardAccounts: [{
            accountId: failedAccountId,
            connectedAt: new Date(),
            bankId: 'visaCal',
            displayName: 'Visa Cal Credit Cards'
          }]
        },
        creditCardMatching: {
          completed: true,
          completedAt: new Date(),
          error: 'Visa Cal Credit Cards could not be imported.',
          failedAccount: {
            accountId: failedAccountId,
            bankId: 'visaCal',
            displayName: 'Visa Cal Credit Cards',
            error: 'The bank requires a password change.'
          },
          totalCreditCardPayments: 5,
          coveredPayments: 2,
          uncoveredPayments: 3,
          coveragePercentage: 40,
          matchedPayments: []
        }
      };
      await testUser.save();
    });

    it('updates credentials and returns the account to processing', async () => {
      bankAccountService.updateCredentials.mockResolvedValue({
        _id: failedAccountId
      });

      const response = await request(app)
        .put(`/api/onboarding/credit-card-account/${failedAccountId}/credentials`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          username: 'cal-user',
          password: 'new-password'
        });

      expect(response.status).toBe(200);
      expect(bankAccountService.updateCredentials).toHaveBeenCalledWith(
        failedAccountId.toString(),
        testUser._id,
        {
          username: 'cal-user',
          password: 'new-password',
          card6Digits: undefined
        },
        {
          requireQueuedSync: true,
          deferCredentialValidation: true
        }
      );

      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.onboarding.creditCardMatching.completed).toBe(false);
      expect(updatedUser.onboarding.creditCardMatching.processingAccountId.toString())
        .toBe(failedAccountId.toString());
      expect(updatedUser.onboarding.creditCardMatching.error).toBeNull();
      expect(updatedUser.onboarding.creditCardMatching.failedAccount).toBeNull();
    });

    it('restores the failed account when the retry cannot be queued', async () => {
      const queueError = new Error(
        'Credentials were updated, but the automatic import retry could not be started: Queue unavailable'
      );
      queueError.code = 'SYNC_QUEUE_FAILED';
      bankAccountService.updateCredentials.mockRejectedValue(queueError);

      const response = await request(app)
        .put(`/api/onboarding/credit-card-account/${failedAccountId}/credentials`)
        .set('Authorization', ['Bearer', authToken].join(' '))
        .send({
          username: 'cal-user',
          password: 'new-password'
        });

      expect(response.status).toBe(503);
      expect(response.body.error)
        .toBe('Credentials updated, but the card import retry could not be started');

      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.onboarding.creditCardMatching.completed).toBe(true);
      expect(updatedUser.onboarding.creditCardMatching.processingAccountId).toBeNull();
      expect(updatedUser.onboarding.creditCardMatching.failedAccount).toEqual(
        expect.objectContaining({
          accountId: failedAccountId,
          bankId: 'visaCal',
          displayName: 'Visa Cal Credit Cards',
          error: expect.stringContaining('Queue unavailable')
        })
      );
    });

    it('removes the failed account and preserves the previous matching result', async () => {
      bankAccountService.delete.mockResolvedValue(true);

      const response = await request(app)
        .delete(`/api/onboarding/credit-card-account/${failedAccountId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(bankAccountService.delete).toHaveBeenCalledWith(
        failedAccountId.toString(),
        testUser._id
      );

      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.onboarding.creditCardSetup.creditCardAccounts).toHaveLength(0);
      expect(updatedUser.onboarding.creditCardMatching).toEqual(expect.objectContaining({
        completed: true,
        error: null,
        totalCreditCardPayments: 5,
        coveredPayments: 2,
        uncoveredPayments: 3,
        coveragePercentage: 40
      }));
      expect(updatedUser.onboarding.creditCardMatching.failedAccount).toBeNull();
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
      expect(data.checkingAccount.accountId.displayName).toBe('My Checking');
      expect(data.checkingAccount.accountId).not.toHaveProperty('credentials');
      expect(data.transactionImport.completed).toBe(true);
      expect(data.transactionImport.transactionsImported).toBe(150);
      expect(data.creditCardDetection.analyzed).toBe(true);
      expect(data.creditCardDetection.recommendation).toBe('connect');
      expect(data.creditCardSetup.creditCardAccounts).toHaveLength(1);
      expect(data.creditCardSetup.creditCardAccounts[0].accountId.displayName).toBe('Isracard');
      expect(data.creditCardSetup.creditCardAccounts[0].accountId).not.toHaveProperty('credentials');
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

    it('repairs a zero-result card analysis that ran before categorization finished', async () => {
      const analyzedAt = new Date(Date.now() - 60 * 1000);
      const accountId = new mongoose.Types.ObjectId();
      const category = await Category.create({
        name: 'Credit Card',
        type: 'Transfer',
        userId: testUser._id
      });

      await Transaction.create({
        identifier: 'card-payment-after-analysis',
        userId: testUser._id,
        accountId,
        amount: -4321,
        currency: 'ILS',
        date: new Date(),
        description: 'MAX monthly payment',
        category: category._id,
        rawData: { description: 'MAX monthly payment' }
      });

      testUser.onboarding = {
        isComplete: false,
        currentStep: 'credit-card-detection',
        transactionImport: {
          completed: true,
          transactionsImported: 150,
          completedAt: analyzedAt
        },
        creditCardDetection: {
          analyzed: true,
          analyzedAt,
          transactionCount: 0,
          recommendation: 'skip',
          sampleTransactions: []
        },
        completedSteps: ['checking-account', 'transaction-import']
      };
      await testUser.save();

      const response = await request(app)
        .get('/api/onboarding/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.creditCardDetection.transactionCount).toBe(1);
      expect(response.body.data.creditCardDetection.recommendation).not.toBe('skip');
      expect(response.body.data.creditCardDetection.sampleTransactions).toEqual([
        expect.objectContaining({ description: 'MAX monthly payment', amount: 4321 })
      ]);

      const repairedUser = await User.findById(testUser._id);
      expect(repairedUser.onboarding.creditCardDetection.transactionCount).toBe(1);
      expect(repairedUser.onboarding.creditCardDetection.analyzedAt.getTime())
        .toBeGreaterThan(analyzedAt.getTime());
    });

    it('repairs a zero-result analysis when recognizable card payments were miscategorized', async () => {
      const analyzedAt = new Date();
      const expenseCategory = await Category.create({
        name: 'Financial Services',
        type: 'Expense',
        userId: testUser._id
      });

      await Transaction.create({
        identifier: 'miscategorized-card-payment',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -10009.46,
        currency: 'ILS',
        date: new Date(),
        description: 'כרטיסי אשראי-י',
        type: 'Expense',
        category: expenseCategory._id,
        categorizationMethod: 'ai',
        rawData: { description: 'כרטיסי אשראי-י' }
      });

      testUser.onboarding = {
        isComplete: false,
        currentStep: 'credit-card-detection',
        transactionImport: {
          completed: true,
          transactionsImported: 1,
          completedAt: analyzedAt
        },
        creditCardDetection: {
          analyzed: true,
          analyzedAt,
          transactionCount: 0,
          recommendation: 'skip',
          sampleTransactions: []
        },
        completedSteps: ['checking-account', 'transaction-import']
      };
      await testUser.save();

      const response = await request(app)
        .get('/api/onboarding/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.creditCardDetection.transactionCount).toBe(1);
      expect(response.body.data.creditCardDetection.recommendation).toBe('connect');
      expect(response.body.data.creditCardDetection.sampleTransactions).toEqual([
        expect.objectContaining({
          description: 'כרטיסי אשראי-י',
          amount: 10009.46
        })
      ]);
    });

    it('repairs an incremental import count to the checking account total', async () => {
      const accountId = new mongoose.Types.ObjectId();
      for (let index = 0; index < 3; index += 1) {
        await Transaction.create({
          identifier: `imported-total-${index}`,
          userId: testUser._id,
          accountId,
          amount: -(index + 1) * 100,
          currency: 'ILS',
          date: new Date(),
          description: `Imported transaction ${index}`,
          rawData: { description: `Imported transaction ${index}` }
        });
      }

      testUser.onboarding = {
        isComplete: false,
        currentStep: 'credit-card-detection',
        checkingAccount: {
          connected: true,
          accountId,
          connectedAt: new Date(),
          bankId: 'hapoalim'
        },
        transactionImport: {
          completed: true,
          transactionsImported: 1,
          completedAt: new Date()
        },
        creditCardDetection: {
          analyzed: true,
          analyzedAt: new Date(),
          transactionCount: 1,
          recommendation: 'connect',
          sampleTransactions: []
        },
        completedSteps: ['checking-account', 'transaction-import']
      };
      await testUser.save();

      const countDocuments = jest.spyOn(Transaction, 'countDocuments');
      const response = await request(app)
        .get('/api/onboarding/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.transactionImport.transactionsImported).toBe(3);
      const repairedUser = await User.findById(testUser._id);
      expect(repairedUser.onboarding.transactionImport.transactionsImported).toBe(3);
      expect(repairedUser.onboarding.transactionImport.countVerifiedAt).toBeTruthy();
      expect(countDocuments).toHaveBeenCalledTimes(1);

      countDocuments.mockClear();
      const secondResponse = await request(app)
        .get('/api/onboarding/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(secondResponse.status).toBe(200);
      expect(secondResponse.body.data.transactionImport.transactionsImported).toBe(3);
      expect(countDocuments).not.toHaveBeenCalled();
      countDocuments.mockRestore();
    });

    it('does not refresh when only an older transaction was categorized after analysis', async () => {
      const analyzedAt = new Date(Date.now() - 60 * 1000);
      const oldTransactionDate = new Date();
      oldTransactionDate.setMonth(oldTransactionDate.getMonth() - 3);
      const category = await Category.create({
        name: 'Credit Card',
        type: 'Transfer',
        userId: testUser._id
      });

      await Transaction.create({
        identifier: 'old-card-payment-after-analysis',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -2345,
        currency: 'ILS',
        date: oldTransactionDate,
        description: 'Old MAX monthly payment',
        category: category._id,
        rawData: { description: 'Old MAX monthly payment' }
      });

      testUser.onboarding = {
        isComplete: false,
        currentStep: 'credit-card-detection',
        transactionImport: {
          completed: true,
          transactionsImported: 150,
          completedAt: analyzedAt
        },
        creditCardDetection: {
          analyzed: true,
          analyzedAt,
          transactionCount: 0,
          recommendation: 'skip',
          sampleTransactions: []
        },
        completedSteps: ['checking-account', 'transaction-import']
      };
      await testUser.save();

      const response = await request(app)
        .get('/api/onboarding/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.creditCardDetection.transactionCount).toBe(0);

      const unchangedUser = await User.findById(testUser._id);
      expect(unchangedUser.onboarding.creditCardDetection.analyzedAt.getTime())
        .toBe(analyzedAt.getTime());
    });

    it('does not wait forever when a categorization job never finishes', async () => {
      const importCompletedAt = new Date(Date.now() - 16 * 60 * 1000);
      const category = await Category.create({
        name: 'Credit Card',
        type: 'Transfer',
        userId: testUser._id
      });

      await Transaction.create({
        identifier: 'card-payment-after-timeout',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -1234,
        currency: 'ILS',
        date: new Date(),
        description: 'Isracard monthly payment',
        category: category._id,
        rawData: { description: 'Isracard monthly payment' }
      });

      testUser.onboarding = {
        isComplete: false,
        currentStep: 'transaction-import',
        transactionImport: {
          completed: true,
          transactionsImported: 150,
          completedAt: importCompletedAt
        },
        creditCardDetection: {
          analyzed: false,
          transactionCount: 0,
          sampleTransactions: []
        },
        completedSteps: ['checking-account', 'transaction-import']
      };
      await testUser.save();

      const response = await request(app)
        .get('/api/onboarding/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.currentStep).toBe('credit-card-detection');
      expect(response.body.data.creditCardDetection.analyzed).toBe(true);
      expect(response.body.data.creditCardDetection.transactionCount).toBe(1);
    });
  });
});
