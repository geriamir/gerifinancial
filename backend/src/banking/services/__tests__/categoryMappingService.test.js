const mongoose = require('mongoose');
const categoryMappingService = require('../categoryMappingService');
const { Category, SubCategory, Transaction, ManualCategorized } = require('../../models');
const { CategorizationMethod, TransactionType } = require('../../constants/enums');
const llmCategorizer = require('../llmCategorizer');
const llmService = require('../../../shared/services/ai/llmService');
const config = require('../../../shared/config');

const originalLlmEnabled = config.ai.llm.categorization;

describe('CategoryMappingService', () => {
  let testUserId;
  let testExpenseCategory;
  let testIncomeCategory;
  let testTransferCategory;
  let testExpenseSubCategory;
  let testIncomeSubCategory;
  let testTransferSubCategory;

  beforeEach(async () => {
    // Clean up before each test
    await Promise.all([
      Category.deleteMany({}),
      SubCategory.deleteMany({}),
      Transaction.deleteMany({}),
      ManualCategorized.deleteMany({})
    ]);
    
    testUserId = new mongoose.Types.ObjectId();
    
    // Create test categories for both Income and Expense
    testExpenseCategory = await Category.create({
      name: 'Test Expense Category',
      type: TransactionType.EXPENSE,
      userId: testUserId
    });

    testIncomeCategory = await Category.create({
      name: 'Test Income Category',
      type: TransactionType.INCOME,
      userId: testUserId
    });

    testTransferCategory = await Category.create({
      name: 'Test Transfer Category',
      type: TransactionType.TRANSFER,
      userId: testUserId
    });

    // Create subcategories for both types
    testExpenseSubCategory = await SubCategory.create({
      name: 'Test Expense SubCategory',
      parentCategory: testExpenseCategory._id,
      keywords: ['test', 'coffee'],
      userId: testUserId
    });

    testIncomeSubCategory = await SubCategory.create({
      name: 'Test Income SubCategory',
      parentCategory: testIncomeCategory._id,
      keywords: ['salary', 'payment'],
      userId: testUserId
    });

    testTransferSubCategory = await SubCategory.create({
      name: 'Test Transfer SubCategory',
      parentCategory: testTransferCategory._id,
      keywords: ['credit', 'card', 'transfer'],
      userId: testUserId
    });

    // Update categories with subcategory references
    testExpenseCategory.subCategories = [testExpenseSubCategory._id];
    await testExpenseCategory.save();

    testIncomeCategory.subCategories = [testIncomeSubCategory._id];
    await testIncomeCategory.save();

    testTransferCategory.subCategories = [testTransferSubCategory._id];
    await testTransferCategory.save();
  });

  afterAll(async () => {
    await Promise.all([
      Category.deleteMany({}),
      SubCategory.deleteMany({}),
      Transaction.deleteMany({}),
      ManualCategorized.deleteMany({})
    ]);
  });

  describe('attemptAutoCategorization', () => {
    it('should not categorize into another user\'s subcategory', async () => {
      // Keyword matching used to query every subcategory in the collection, so
      // one user's keywords could pull another user's transaction into a
      // category that user does not own - and the foreign id was then persisted
      // on the transaction.
      const otherUserId = new mongoose.Types.ObjectId();
      const otherCategory = await Category.create({
        name: 'Other User Category',
        type: TransactionType.EXPENSE,
        userId: otherUserId
      });
      const otherSubCategory = await SubCategory.create({
        name: 'Other User SubCategory',
        parentCategory: otherCategory._id,
        keywords: ['tzatziki'],
        userId: otherUserId
      });

      const transaction = await Transaction.create({
        identifier: 'test-tx-cross-user',
        description: 'tzatziki',
        userId: testUserId,
        accountId: new mongoose.Types.ObjectId(),
        amount: -20,
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.EXPENSE,
        rawData: { description: 'tzatziki' }
      });

      const updated = await categoryMappingService.attemptAutoCategorization(transaction);

      const assignedCategory = updated?.category?._id?.toString() ?? null;
      const assignedSubCategory = updated?.subCategory?._id?.toString() ?? null;
      expect(assignedCategory).not.toBe(otherCategory._id.toString());
      expect(assignedSubCategory).not.toBe(otherSubCategory._id.toString());
    });

    it('should only use expense categories for negative amounts using manual categorization', async () => {
      // Create manual categorization entries for both income and expense
      // Create manual categorization entry with a slightly different description
      await ManualCategorized.create({
        description: 'coffee shop expense',
        userId: testUserId,
        category: testExpenseCategory._id,
        subCategory: testExpenseSubCategory._id
      });

      const transaction = await Transaction.create({
        identifier: 'test-tx-1',
        description: 'coffee shop expense',
        userId: testUserId,
        accountId: new mongoose.Types.ObjectId(),
        amount: -50, // Negative amount -> Should use expense category
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.EXPENSE,
        rawData: {
          originalData: 'test',
          description: 'Coffee Shop Purchase',
          chargedAmount: -50
        }
      });

      const updated = await categoryMappingService.attemptAutoCategorization(transaction);

      expect(updated.category._id.toString()).toBe(testExpenseCategory._id.toString());
      expect(updated.subCategory._id.toString()).toBe(testExpenseSubCategory._id.toString());
      expect(transaction.categorizationMethod).toBe(CategorizationMethod.PREVIOUS_DATA);
    });

    it('should only use income categories for positive amounts using manual categorization', async () => {
      // Create manual categorization entries for both income and expense
      // Create manual categorization entry with a slightly different description
      await ManualCategorized.create({
        description: 'salary payment income',
        userId: testUserId,
        category: testIncomeCategory._id,
        subCategory: testIncomeSubCategory._id
      });

      const transaction = await Transaction.create({
        identifier: 'test-tx-2',
        description: 'salary payment income',
        userId: testUserId,
        accountId: new mongoose.Types.ObjectId(),
        amount: 5000, // Positive amount -> Should use income category
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.INCOME,
        rawData: {
          originalData: 'test',
          description: 'Salary Payment',
          chargedAmount: 5000
        }
      });

      const updated = await categoryMappingService.attemptAutoCategorization(transaction);

      expect(updated.category._id.toString()).toBe(testIncomeCategory._id.toString());
      expect(updated.subCategory._id.toString()).toBe(testIncomeSubCategory._id.toString());
      expect(transaction.categorizationMethod).toBe(CategorizationMethod.PREVIOUS_DATA);
    });

    it('should only use expense categories for negative amounts using keyword matching', async () => {
      const transaction = await Transaction.create({
        identifier: 'test-tx-3',
        description: 'Test Coffee Purchase',
        userId: testUserId,
        accountId: new mongoose.Types.ObjectId(),
        amount: -50,
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.EXPENSE,
        rawData: {
          originalData: 'test',
          description: 'Test Coffee Purchase',
          chargedAmount: -50
        }
      });

      const updated = await categoryMappingService.attemptAutoCategorization(transaction);

      expect(updated.category._id.toString()).toBe(testExpenseCategory._id.toString());
      expect(updated.subCategory._id.toString()).toBe(testExpenseSubCategory._id.toString());
      expect(updated.categorizationMethod).toBe(CategorizationMethod.PREVIOUS_DATA);
    });

    it('should only use income categories for positive amounts using keyword matching', async () => {
      const transaction = await Transaction.create({
        identifier: 'test-tx-4',
        description: 'Monthly Salary Payment',
        userId: testUserId,
        accountId: new mongoose.Types.ObjectId(),
        amount: 5000,
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.INCOME,
        rawData: {
          originalData: 'test',
          description: 'Monthly Salary Payment',
          chargedAmount: 5000
        }
      });

      const updated = await categoryMappingService.attemptAutoCategorization(transaction);

      expect(updated.category._id.toString()).toBe(testIncomeCategory._id.toString());
      expect(updated.subCategory._id.toString()).toBe(testIncomeSubCategory._id.toString());
      expect(updated.categorizationMethod).toBe(CategorizationMethod.PREVIOUS_DATA);
    });

    it('should not override existing categorization', async () => {
      const existingCategory = await Category.create({
        name: 'Existing Category',
        type: TransactionType.EXPENSE,
        userId: testUserId
      });

      const existingSubCategory = await SubCategory.create({
        name: 'Existing SubCategory',
        parentCategory: existingCategory._id,
        userId: testUserId
      });

      const transaction = await Transaction.create({
        identifier: 'test-tx-5',
        description: 'Coffee Shop Purchase',
        userId: testUserId,
        accountId: new mongoose.Types.ObjectId(),
        amount: -50,
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.EXPENSE,
        category: existingCategory._id,
        subCategory: existingSubCategory._id,
        categorizationMethod: CategorizationMethod.MANUAL,
        rawData: {
          originalData: 'test',
          description: 'Coffee Shop Purchase',
          chargedAmount: -50
        }
      });

      await categoryMappingService.attemptAutoCategorization(transaction);

      expect(transaction.category).toEqual(existingCategory._id);
      expect(transaction.subCategory).toEqual(existingSubCategory._id);
      expect(transaction.categorizationMethod).toBe(CategorizationMethod.MANUAL);
    });

    it('should allow transfer categories for positive amounts using keyword matching', async () => {
      const transaction = await Transaction.create({
        identifier: 'test-tx-6',
        description: 'Credit Card Transfer Payment',
        userId: testUserId,
        accountId: new mongoose.Types.ObjectId(),
        amount: 1000,
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.TRANSFER,
        rawData: {
          originalData: 'test',
          description: 'Credit Card Transfer Payment',
          chargedAmount: 1000
        }
      });

      const updated = await categoryMappingService.attemptAutoCategorization(transaction);

      expect(updated.category._id.toString()).toBe(testTransferCategory._id.toString());
      expect(updated.subCategory._id.toString()).toBe(testTransferSubCategory._id.toString());
      expect(transaction.categorizationMethod).toBe(CategorizationMethod.PREVIOUS_DATA);
    });

    it('should allow transfer categories for negative amounts using keyword matching', async () => {
      const transaction = await Transaction.create({
        identifier: 'test-tx-7',
        description: 'Credit Card Transfer Payment',
        userId: testUserId,
        accountId: new mongoose.Types.ObjectId(),
        amount: 1000, // Transfer transactions must be positive
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.TRANSFER,
        rawData: {
          originalData: 'test',
          description: 'Credit Card Transfer Payment',
          chargedAmount: -1000
        }
      });

      const updated = await categoryMappingService.attemptAutoCategorization(transaction);

      expect(updated.category._id.toString()).toBe(testTransferCategory._id.toString());
      expect(updated.subCategory._id.toString()).toBe(testTransferSubCategory._id.toString());
      expect(updated.categorizationMethod).toBe(CategorizationMethod.PREVIOUS_DATA);
    });

    it('should allow transfer categories using manual categorization regardless of amount', async () => {
      await ManualCategorized.create({
        description: 'bank transfer',
        userId: testUserId,
        category: testTransferCategory._id,
        subCategory: testTransferSubCategory._id
      });

      // Test with positive amount
      const positiveTransaction = await Transaction.create({
        identifier: 'test-tx-8',
        description: 'Bank Transfer Payment',
        userId: testUserId,
        accountId: new mongoose.Types.ObjectId(),
        amount: 1000,
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.TRANSFER,
        rawData: {
          originalData: 'test',
          description: 'Bank Transfer Payment',
          chargedAmount: 1000
        }
      });

      const updatedPositive = await categoryMappingService.attemptAutoCategorization(positiveTransaction);
      expect(updatedPositive.category._id.toString()).toBe(testTransferCategory._id.toString());
      expect(updatedPositive.subCategory._id.toString()).toBe(testTransferSubCategory._id.toString());

      // Test with negative amount
      const negativeTransaction = await Transaction.create({
        identifier: 'test-tx-9',
        description: 'Bank Transfer Payment',
        userId: testUserId,
        accountId: new mongoose.Types.ObjectId(),
        amount: 1000, // Transfer transactions must be positive
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.TRANSFER,
        rawData: {
          originalData: 'test',
          description: 'Bank Transfer Payment',
          chargedAmount: -1000
        }
      });

      const updatedNegative = await categoryMappingService.attemptAutoCategorization(negativeTransaction);
      expect(updatedNegative.category._id.toString()).toBe(testTransferCategory._id.toString());
      expect(updatedNegative.subCategory._id.toString()).toBe(testTransferSubCategory._id.toString());
    });

    it('should handle transactions without matches', async () => {
      const transaction = await Transaction.create({
        identifier: 'test-tx-10',
        description: 'Unique Purchase Without Match',
        userId: testUserId,
        accountId: new mongoose.Types.ObjectId(),
        amount: -50,
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.EXPENSE,
        rawData: {
          originalData: 'test',
          description: 'Unique Purchase Without Match',
          chargedAmount: -50
        }
      });

      const updated = await categoryMappingService.attemptAutoCategorization(transaction);

      // Should not have category or subCategory set
      expect(updated).toBeUndefined();
    });

    // The tier that exists for users who have corrected nothing yet: every
    // tier ahead of it learns from the user, so all of them are silent on a
    // first scrape.
    describe('the model fallback tier', () => {
      const uncategorisable = (overrides = {}) =>
        Transaction.create({
          identifier: `llm-tx-${Math.random()}`,
          description: 'שופרסל דיל',
          userId: testUserId,
          accountId: new mongoose.Types.ObjectId(),
          amount: -250,
          currency: 'ILS',
          date: new Date(),
          rawData: { description: 'שופרסל דיל', chargedAmount: -250 },
          ...overrides
        });

      beforeEach(() => {
        config.ai.llm.categorization = true;
        llmService.__setEnabled(true);
        llmService.__setChatResponse({
          content: JSON.stringify({
            category: 'Test Expense Category',
            subCategory: 'Test Expense SubCategory',
            confidence: 0.9
          })
        });
      });

      afterEach(() => {
        config.ai.llm.categorization = originalLlmEnabled;
      });

      it('categorises a transaction no earlier tier could place', async () => {
        const updated = await categoryMappingService.attemptAutoCategorization(await uncategorisable());

        expect(updated.category._id).toEqual(testExpenseCategory._id);
        expect(updated.subCategory._id).toEqual(testExpenseSubCategory._id);
        expect(updated.categorizationMethod).toBe(CategorizationMethod.AI);
      });

      it('records why, so the user can tell it was a guess and correct it', async () => {
        const updated = await categoryMappingService.attemptAutoCategorization(await uncategorisable());

        expect(updated.categorizationReasoning).toContain('Chose from your categories:');
      });

      it('sets the transaction type from the category it chose', async () => {
        const updated = await categoryMappingService.attemptAutoCategorization(await uncategorisable());

        expect(updated.type).toBe(TransactionType.EXPENSE);
      });

      // It is the most expensive tier and the weakest evidence, so anything the
      // user has already taught the app has to win before it is asked.
      it('is not consulted when a keyword already matched', async () => {
        await categoryMappingService.attemptAutoCategorization(
          await uncategorisable({ description: 'coffee shop', rawData: { description: 'coffee shop' } })
        );

        expect(llmService.chat).not.toHaveBeenCalled();
      });

      it('is not consulted when the user has categorised this exact description before', async () => {
        await ManualCategorized.create({
          description: 'שופרסל דיל',
          userId: testUserId,
          category: testExpenseCategory._id,
          subCategory: testExpenseSubCategory._id
        });

        await categoryMappingService.attemptAutoCategorization(await uncategorisable());

        expect(llmService.chat).not.toHaveBeenCalled();
      });

      // An environment with no Azure OpenAI has to behave exactly as it did
      // before this tier existed.
      it('leaves the transaction alone when the model is not configured', async () => {
        llmService.__setEnabled(false);

        const updated = await categoryMappingService.attemptAutoCategorization(await uncategorisable());

        expect(updated).toBeUndefined();
        expect(llmService.chat).not.toHaveBeenCalled();
      });

      it('leaves the transaction alone when the model declines', async () => {
        llmService.__setChatResponse({ content: JSON.stringify({ category: null, confidence: 0 }) });

        const updated = await categoryMappingService.attemptAutoCategorization(await uncategorisable());

        expect(updated).toBeUndefined();
      });

      // The batch worker loads one catalogue for the whole scrape; passing it in
      // is what keeps the repeated-merchant cache alive across transactions.
      it('reuses a catalogue supplied by the caller', async () => {
        const catalogue = await llmCategorizer.forUser(testUserId);

        await categoryMappingService.attemptAutoCategorization(await uncategorisable(), { catalogue });
        await categoryMappingService.attemptAutoCategorization(await uncategorisable(), { catalogue });

        expect(llmService.chat).toHaveBeenCalledTimes(1);
      });
    });
  });
});
