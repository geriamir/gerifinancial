const mongoose = require('mongoose');
const scrapingEvents = require('../../banking/services/scrapingEvents');
const onboardingEventHandlers = require('../services/onboardingEventHandlers');
const { User } = require('../../auth');
const { BankAccount, Transaction, CreditCard } = require('../../banking');
const creditCardDetectionService = require('../../banking/services/creditCardDetectionService');

// Mock the credit card detection service
jest.mock('../../banking/services/creditCardDetectionService');

describe('Onboarding Event Handlers', () => {
  let testUser;
  let checkingAccountId;
  let creditCardAccountId;

  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gerifinancial-test', {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
    }

    // Initialize event handlers
    onboardingEventHandlers.initialize();
  });

  beforeEach(async () => {
    // Clear collections
    await User.deleteMany({});
    await BankAccount.deleteMany({});
    await Transaction.deleteMany({});
    await CreditCard.deleteMany({});

    // Create test user
    testUser = await User.create({
      email: 'test@example.com',
      githubId: 90501,
      githubLogin: 'test-user',
      name: 'Test User'
    });

    // Create checking account
    checkingAccountId = new mongoose.Types.ObjectId();
    await BankAccount.create({
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

    // Create credit card account
    creditCardAccountId = new mongoose.Types.ObjectId();
    await BankAccount.create({
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
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('checking-accounts:started event', () => {
    it('should update onboarding status when account matches onboarding checking account', async () => {
      // Set up user with onboarding checking account
      testUser.onboarding = {
        startedAt: new Date(),
        checkingAccount: {
          connected: true,
          accountId: checkingAccountId,
          connectedAt: new Date(),
          bankId: 'hapoalim'
        },
        currentStep: 'transaction-import',
        completedSteps: ['checking-account']
      };
      await testUser.save();

      // Emit event
      scrapingEvents.emit('checking-accounts:started', {
        strategyName: 'checking-accounts',
        bankAccountId: checkingAccountId,
        userId: testUser._id
      });

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify bank account was updated
      const bankAccount = await BankAccount.findById(checkingAccountId);
      expect(bankAccount.scrapingStatus.isActive).toBe(true);
      expect(bankAccount.scrapingStatus.status).toBe('scraping');

      // Verify onboarding was updated
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.onboarding.transactionImport.scrapingStatus.isActive).toBe(true);
      expect(updatedUser.onboarding.transactionImport.scrapingStatus.status).toBe('scraping');
    });

    it('should NOT update onboarding status when account does not match', async () => {
      // Set up user with different checking account
      const differentAccountId = new mongoose.Types.ObjectId();
      testUser.onboarding = {
        startedAt: new Date(),
        checkingAccount: {
          connected: true,
          accountId: differentAccountId,
          connectedAt: new Date(),
          bankId: 'leumi'
        }
      };
      await testUser.save();

      // Emit event for non-onboarding account
      scrapingEvents.emit('checking-accounts:started', {
        strategyName: 'checking-accounts',
        bankAccountId: checkingAccountId,
        userId: testUser._id
      });

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify onboarding transactionImport was NOT updated with active scraping for the wrong account
      const updatedUser = await User.findById(testUser._id);
      // The bankAccount gets initialized with scraping status, but onboarding shouldn't be updated
      const bankAccount = await BankAccount.findById(checkingAccountId);
      expect(bankAccount.scrapingStatus.isActive).toBe(true);
      
      // Onboarding transactionImport should not have been updated since account doesn't match
      if (updatedUser.onboarding.transactionImport && updatedUser.onboarding.transactionImport.scrapingStatus) {
        expect(updatedUser.onboarding.transactionImport.scrapingStatus.isActive).not.toBe(true);
      }
    });

    it('does not move onboarding backwards when a later sync starts', async () => {
      testUser.onboarding = {
        startedAt: new Date(),
        checkingAccount: {
          connected: true,
          accountId: checkingAccountId,
          connectedAt: new Date(),
          bankId: 'hapoalim'
        },
        currentStep: 'credit-card-setup',
        transactionImport: {
          completed: true,
          transactionsImported: 150,
          completedAt: new Date()
        },
        completedSteps: ['checking-account', 'transaction-import', 'credit-card-detection']
      };
      await testUser.save();

      scrapingEvents.emit('checking-accounts:started', {
        strategyName: 'checking-accounts',
        bankAccountId: checkingAccountId,
        userId: testUser._id
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.onboarding.currentStep).toBe('credit-card-setup');
      expect(updatedUser.onboarding.transactionImport.scrapingStatus.status).toBe('scraping');
    });
  });

  describe('checking-accounts:completed event', () => {
    beforeEach(async () => {
      // Set up user with onboarding checking account
      testUser.onboarding = {
        startedAt: new Date(),
        checkingAccount: {
          connected: true,
          accountId: checkingAccountId,
          connectedAt: new Date(),
          bankId: 'hapoalim'
        },
        currentStep: 'transaction-import',
        completedSteps: ['checking-account']
      };
      await testUser.save();

      // Mock credit card detection
      creditCardDetectionService.analyzeCreditCardUsage.mockResolvedValue({
        transactionCount: 10,
        recommendation: 'connect',
        sampleTransactions: [
          {
            date: new Date(),
            description: 'Credit Card Payment',
            amount: 2500
          }
        ]
      });
    });

    it('should update onboarding and run credit card detection', async () => {
      // Emit completion event
      scrapingEvents.emit('checking-accounts:completed', {
        strategyName: 'checking-accounts',
        bankAccountId: checkingAccountId,
        userId: testUser._id,
        result: {
          transactions: {
            newTransactions: 150
          }
        }
      });

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify bank account was updated
      const bankAccount = await BankAccount.findById(checkingAccountId);
      expect(bankAccount.scrapingStatus.isActive).toBe(false);
      expect(bankAccount.scrapingStatus.status).toBe('complete');
      expect(bankAccount.scrapingStatus.transactionsImported).toBe(150);

      // Verify onboarding was updated
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.onboarding.transactionImport.completed).toBe(true);
      expect(updatedUser.onboarding.transactionImport.transactionsImported).toBe(150);
      
      // Verify credit card detection was run
      expect(updatedUser.onboarding.creditCardDetection.analyzed).toBe(true);
      expect(updatedUser.onboarding.creditCardDetection.transactionCount).toBe(10);
      expect(updatedUser.onboarding.creditCardDetection.recommendation).toBe('connect');
      
      // Verify current step - always shows detection UI first
      expect(updatedUser.onboarding.currentStep).toBe('credit-card-detection');
      
      // Verify completed steps
      expect(updatedUser.onboarding.completedSteps).toContain('transaction-import');

      // Verify credit card detection service was called
      expect(creditCardDetectionService.analyzeCreditCardUsage).toHaveBeenCalled();
      const callArgs = creditCardDetectionService.analyzeCreditCardUsage.mock.calls[0];
      expect(callArgs[0].toString()).toEqual(testUser._id.toString());
      expect(callArgs[1]).toEqual(2);
    });

    it('waits for categorization before deciding whether cards exist', async () => {
      scrapingEvents.emit('checking-accounts:completed', {
        strategyName: 'checking-accounts',
        bankAccountId: checkingAccountId,
        userId: testUser._id,
        result: {
          transactions: {
            newTransactions: 150,
            categorizationJobId: 'categorize-150'
          }
        }
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      let updatedUser = await User.findById(testUser._id);
      expect(updatedUser.onboarding.transactionImport.completed).toBe(true);
      expect(updatedUser.onboarding.currentStep).toBe('transaction-import');
      expect(updatedUser.onboarding.creditCardDetection.analyzed).toBe(false);
      expect(creditCardDetectionService.analyzeCreditCardUsage).not.toHaveBeenCalled();

      scrapingEvents.emit('categorization:completed', {
        userId: testUser._id.toString(),
        total: 150,
        categorized: 96,
        uncategorized: 54,
        failed: 0
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      updatedUser = await User.findById(testUser._id);
      expect(creditCardDetectionService.analyzeCreditCardUsage).toHaveBeenCalledWith(
        testUser._id.toString(),
        2
      );
      expect(updatedUser.onboarding.creditCardDetection.analyzed).toBe(true);
      expect(updatedUser.onboarding.creditCardDetection.transactionCount).toBe(10);
      expect(updatedUser.onboarding.currentStep).toBe('credit-card-detection');
    });

    it('does not lose a categorization event that beats the scrape-completion write', async () => {
      scrapingEvents.emit('checking-accounts:completed', {
        strategyName: 'checking-accounts',
        bankAccountId: checkingAccountId,
        userId: testUser._id,
        result: {
          transactions: {
            newTransactions: 1,
            categorizationJobId: 'categorize-one'
          }
        }
      });

      // EventEmitter does not await async listeners. A one-row categorization
      // batch can therefore finish while the completion handler is at its first
      // database read.
      scrapingEvents.emit('categorization:completed', {
        userId: testUser._id.toString(),
        total: 1,
        categorized: 1,
        uncategorized: 0,
        failed: 0
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      const updatedUser = await User.findById(testUser._id);
      expect(creditCardDetectionService.analyzeCreditCardUsage).toHaveBeenCalledWith(
        testUser._id.toString(),
        2
      );
      expect(updatedUser.onboarding.creditCardDetection.analyzed).toBe(true);
      expect(updatedUser.onboarding.currentStep).toBe('credit-card-detection');
    });

    it('does not move onboarding backwards when a late categorization batch finishes', async () => {
      testUser.onboarding.transactionImport = {
        completed: true,
        transactionsImported: 150,
        completedAt: new Date()
      };
      testUser.onboarding.currentStep = 'credit-card-setup';
      await testUser.save();

      scrapingEvents.emit('categorization:completed', {
        userId: testUser._id.toString(),
        total: 20,
        categorized: 20,
        uncategorized: 0,
        failed: 0
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      const updatedUser = await User.findById(testUser._id);
      expect(creditCardDetectionService.analyzeCreditCardUsage).not.toHaveBeenCalled();
      expect(updatedUser.onboarding.currentStep).toBe('credit-card-setup');
    });

    it('does not move onboarding backwards when a later checking sync completes', async () => {
      testUser.onboarding.transactionImport = {
        completed: true,
        transactionsImported: 150,
        completedAt: new Date()
      };
      testUser.onboarding.currentStep = 'credit-card-setup';
      testUser.onboarding.completedSteps = [
        'checking-account',
        'transaction-import',
        'credit-card-detection'
      ];
      await testUser.save();

      for (let index = 0; index < 3; index += 1) {
        await Transaction.create({
          identifier: `existing-checking-transaction-${index}`,
          userId: testUser._id,
          accountId: checkingAccountId,
          amount: -(index + 1) * 100,
          currency: 'ILS',
          date: new Date(),
          description: `Existing transaction ${index}`,
          rawData: { description: `Existing transaction ${index}` }
        });
      }

      scrapingEvents.emit('checking-accounts:completed', {
        strategyName: 'checking-accounts',
        bankAccountId: checkingAccountId,
        userId: testUser._id,
        result: {
          transactions: {
            newTransactions: 1
          }
        }
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.onboarding.currentStep).toBe('credit-card-setup');
      expect(updatedUser.onboarding.transactionImport.transactionsImported).toBe(3);
      expect(creditCardDetectionService.analyzeCreditCardUsage).not.toHaveBeenCalled();
    });

    it('falls back to the available transactions when categorization exhausts its retries', async () => {
      scrapingEvents.emit('checking-accounts:completed', {
        strategyName: 'checking-accounts',
        bankAccountId: checkingAccountId,
        userId: testUser._id,
        result: {
          transactions: {
            newTransactions: 150,
            categorizationJobId: 'categorize-150'
          }
        }
      });

      await new Promise(resolve => setTimeout(resolve, 200));
      expect(creditCardDetectionService.analyzeCreditCardUsage).not.toHaveBeenCalled();

      scrapingEvents.emit('categorization:failed', {
        userId: testUser._id.toString(),
        total: 150,
        error: 'corpus unavailable'
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      const updatedUser = await User.findById(testUser._id);
      expect(creditCardDetectionService.analyzeCreditCardUsage).toHaveBeenCalledWith(
        testUser._id.toString(),
        2
      );
      expect(updatedUser.onboarding.creditCardDetection.analyzed).toBe(true);
      expect(updatedUser.onboarding.currentStep).toBe('credit-card-detection');
    });

    it('should complete onboarding if no credit cards detected', async () => {
      // Mock detection with skip recommendation
      creditCardDetectionService.analyzeCreditCardUsage.mockResolvedValue({
        transactionCount: 0,
        recommendation: 'skip',
        sampleTransactions: []
      });

      // Emit completion event
      scrapingEvents.emit('checking-accounts:completed', {
        strategyName: 'checking-accounts',
        bankAccountId: checkingAccountId,
        userId: testUser._id,
        result: {
          transactions: {
            newTransactions: 50
          }
        }
      });

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify credit card detection was run even with skip recommendation
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.onboarding.currentStep).toBe('credit-card-detection');
      expect(updatedUser.onboarding.creditCardDetection.analyzed).toBe(true);
      expect(updatedUser.onboarding.creditCardDetection.recommendation).toBe('skip');
    });
  });

  describe('credit-cards:completed event', () => {
    beforeEach(async () => {
      // Set up user with onboarding credit card
      testUser.onboarding = {
        startedAt: new Date(),
        checkingAccount: {
          connected: true,
          accountId: checkingAccountId,
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
          transactionCount: 10,
          recommendation: 'connect'
        },
        creditCardSetup: {
          skipped: false,
          creditCardAccounts: [{
            accountId: creditCardAccountId,
            connectedAt: new Date(),
            bankId: 'isracard',
            displayName: 'Isracard'
          }]
        },
        currentStep: 'credit-card-matching',
        completedSteps: ['checking-account', 'transaction-import', 'credit-card-detection']
      };
      await testUser.save();

      // Create credit card
      const creditCard = await CreditCard.create({
        userId: testUser._id,
        bankAccountId: creditCardAccountId,
        displayName: 'Isracard',
        cardNumber: '****1234',
        isActive: true
      });

      // Mock credit card coverage analysis
      creditCardDetectionService.analyzeCreditCardCoverage.mockResolvedValue({
        coveredPayments: 8,
        uncoveredPayments: 2,
        coveragePercentage: 80,
        matchedPayments: [
          {
            payment: {
              id: new mongoose.Types.ObjectId(),
              date: new Date(),
              amount: 2500
            },
            matchedCreditCard: {
              id: creditCard._id,
              displayName: 'Isracard'
            },
            matchConfidence: 95
          }
        ]
      });
    });

    it('should run payment matching and complete onboarding when all credit cards finish', async () => {
      // Update bank account scraping status to complete (required by event handler logic)
      await BankAccount.findByIdAndUpdate(creditCardAccountId, {
        $set: {
          'scrapingStatus.status': 'complete',
          'scrapingStatus.isActive': false
        }
      });

      // Emit completion event
      scrapingEvents.emit('credit-cards:completed', {
        strategyName: 'credit-cards',
        bankAccountId: creditCardAccountId,
        userId: testUser._id,
        result: {
          transactions: {
            newTransactions: 50
          }
        }
      });

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify onboarding was updated
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.onboarding.creditCardMatching.completed).toBe(true);
      expect(updatedUser.onboarding.creditCardMatching.coveredPayments).toBe(8);
      expect(updatedUser.onboarding.creditCardMatching.uncoveredPayments).toBe(2);
      expect(updatedUser.onboarding.creditCardMatching.coveragePercentage).toBe(80);
      
      // Verify onboarding is complete
      expect(updatedUser.onboarding.currentStep).toBe('complete');
      expect(updatedUser.onboarding.isComplete).toBe(true);
      expect(updatedUser.onboarding.completedAt).toBeDefined();
      
      // Verify completed steps
      expect(updatedUser.onboarding.completedSteps).toContain('credit-card-setup');
      expect(updatedUser.onboarding.completedSteps).toContain('credit-card-matching');

      // Verify coverage analysis was called
      expect(creditCardDetectionService.analyzeCreditCardCoverage).toHaveBeenCalled();
      const callArgs = creditCardDetectionService.analyzeCreditCardCoverage.mock.calls[0];
      expect(callArgs[0].toString()).toEqual(testUser._id.toString());
    });

    it('should NOT process non-onboarding credit card accounts', async () => {
      // Create a different credit card account not in onboarding
      const nonOnboardingAccountId = new mongoose.Types.ObjectId();
      await BankAccount.create({
        _id: nonOnboardingAccountId,
        userId: testUser._id,
        bankId: 'max',
        accountType: 'creditCard',
        name: 'Max',
        displayName: 'Max',
        isActive: true,
        credentials: {
          username: 'testuser',
          password: 'testpass'
        }
      });

      // Emit completion for non-onboarding account
      scrapingEvents.emit('credit-cards:completed', {
        strategyName: 'credit-cards',
        bankAccountId: nonOnboardingAccountId,
        userId: testUser._id,
        result: {
          transactions: {
            newTransactions: 30
          }
        }
      });

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify onboarding was NOT completed (still waiting for actual onboarding account)
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.onboarding.creditCardMatching.completed).toBe(false);
      expect(updatedUser.onboarding.isComplete).toBe(false);
    });

    it('should wait for all onboarding credit cards before matching', async () => {
      // Add second credit card to onboarding
      const secondCardAccountId = new mongoose.Types.ObjectId();
      await BankAccount.create({
        _id: secondCardAccountId,
        userId: testUser._id,
        bankId: 'max',
        accountType: 'creditCard',
        name: 'Max',
        displayName: 'Max',
        isActive: true,
        credentials: {
          username: 'testuser',
          password: 'testpass'
        },
        scrapingStatus: {
          isActive: true, // Still scraping
          status: 'scraping'
        }
      });

      testUser.onboarding.creditCardSetup.creditCardAccounts.push({
        accountId: secondCardAccountId,
        connectedAt: new Date(),
        bankId: 'max',
        displayName: 'Max'
      });
      await testUser.save();

      // Emit completion for first card only
      scrapingEvents.emit('credit-cards:completed', {
        strategyName: 'credit-cards',
        bankAccountId: creditCardAccountId,
        userId: testUser._id,
        result: {
          transactions: {
            newTransactions: 50
          }
        }
      });

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify matching was NOT run yet (still waiting for second card)
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.onboarding.creditCardMatching.completed).toBe(false);
      expect(creditCardDetectionService.analyzeCreditCardCoverage).not.toHaveBeenCalled();
    });
  });
});
