const mongoose = require('mongoose');
const categoryMappingService = require('../categoryMappingService');
const { Category, SubCategory, Transaction, ManualCategorized } = require('../../models');
const { CategorizationMethod, TransactionType } = require('../../constants/enums');
const { CURRENT_CATEGORIZATION_VERSION } = require('../../constants/categorization');
const llmCategorizer = require('../llmCategorizer');
const llmService = require('../../../shared/services/ai/llmService');
const { AiBudgetExceededError } = require('../../../shared/services/ai/aiBudget');
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

    it('should allow a transfer category to correct a pre-typed expense', async () => {
      const creditCardCategory = await Category.create({
        name: 'Credit Card',
        type: TransactionType.TRANSFER,
        keywords: ['כרטיס אשראי', 'ישראכרט'],
        userId: testUserId
      });
      const transaction = await Transaction.create({
        identifier: 'test-card-payment-pretyped-expense',
        description: 'כרטיסי אשראי-י',
        userId: testUserId,
        accountId: new mongoose.Types.ObjectId(),
        amount: -10009.46,
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.EXPENSE,
        rawData: {
          description: 'כרטיסי אשראי-י',
          chargedAmount: -10009.46
        }
      });

      const updated = await categoryMappingService.attemptAutoCategorization(transaction);

      expect(updated.category._id.toString()).toBe(creditCardCategory._id.toString());
      expect(updated.category.type).toBe(TransactionType.TRANSFER);
      expect(updated.type).toBe(TransactionType.TRANSFER);
    });

    it('should align a pre-typed expense with a matched transfer subcategory', async () => {
      const transaction = await Transaction.create({
        identifier: 'test-transfer-subcategory-pretyped-expense',
        description: 'Bank transfer',
        userId: testUserId,
        accountId: new mongoose.Types.ObjectId(),
        amount: -1000,
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.EXPENSE,
        rawData: {
          description: 'Bank transfer',
          chargedAmount: -1000
        }
      });

      const updated = await categoryMappingService.attemptAutoCategorization(transaction);

      expect(updated.category._id.toString()).toBe(testTransferCategory._id.toString());
      expect(updated.subCategory._id.toString()).toBe(testTransferSubCategory._id.toString());
      expect(updated.type).toBe(TransactionType.TRANSFER);
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

      describe('deferring the model so a batch can be asked at once', () => {
        it('stops before the model and says so, rather than asking', async () => {
          const result = await categoryMappingService.attemptAutoCategorization(
            await uncategorisable(), { deferModel: true }
          );

          expect(result).toBe(categoryMappingService.DEFERRED);
          expect(llmService.chat).not.toHaveBeenCalled();
        });

        // The whole reason deferral needs its own return value. A default type
        // written now would stick, because applying a suggestion only sets the
        // type when there is not one already - so a transfer the model was about
        // to identify would be left permanently marked an expense.
        it('leaves a deferred transaction without a type for the model to set', async () => {
          const transaction = await uncategorisable();

          await categoryMappingService.attemptAutoCategorization(transaction, { deferModel: true });

          expect((await Transaction.findById(transaction._id)).type).toBeUndefined();
        });

        it('still lets the cheap tiers finish a transaction they can place', async () => {
          const result = await categoryMappingService.attemptAutoCategorization(
            await uncategorisable({ description: 'coffee shop', rawData: { description: 'coffee shop' } }),
            { deferModel: true }
          );

          expect(result).not.toBe(categoryMappingService.DEFERRED);
          expect(result.category).toBeTruthy();
        });

        it('settles a deferred transaction from an answer the prefetch already collected', async () => {
          const transaction = await uncategorisable();
          const catalogue = await llmCategorizer.forUser(testUserId);
          await categoryMappingService.attemptAutoCategorization(transaction, { catalogue, deferModel: true });

          llmService.__setChatResponse({
            content: JSON.stringify({
              answers: [{
                id: 1,
                category: 'Test Expense Category',
                subCategory: 'Test Expense SubCategory',
                confidence: 0.9
              }]
            })
          });
          await llmCategorizer.prefetch(catalogue, [{
            description: transaction.description,
            memo: null,
            amount: transaction.amount,
            categoryTypes: categoryMappingService.deriveCategoryTypes(transaction)
          }]);
          llmService.chat.mockClear();

          const updated = await categoryMappingService.finishDeferred(transaction, catalogue);

          expect(updated.category._id).toEqual(testExpenseCategory._id);
          expect(updated.type).toBe(TransactionType.EXPENSE);
          // The point of the whole exercise: the second pass costs nothing.
          expect(llmService.chat).not.toHaveBeenCalled();
        });

        // The prefetch and the lookup that follows it derive the answer cache
        // key independently, and a memo that lives only in rawData is exactly
        // the kind of difference that survives every test built on a hand-made
        // request. If the two ever disagree the batch still succeeds, the cache
        // still fills, and every transaction quietly pays for its own request.
        it('reads back an answer for a transaction whose memo is only in rawData', async () => {
          const transaction = await uncategorisable({
            rawData: { description: 'שופרסל דיל', memo: 'חיוב חודשי', chargedAmount: -250 }
          });
          const catalogue = await llmCategorizer.forUser(testUserId);
          await categoryMappingService.attemptAutoCategorization(transaction, { catalogue, deferModel: true });

          llmService.__setChatResponse({
            content: JSON.stringify({
              answers: [{
                id: 1,
                category: 'Test Expense Category',
                subCategory: 'Test Expense SubCategory',
                confidence: 0.9
              }]
            })
          });
          await llmCategorizer.prefetch(catalogue, [categoryMappingService.toModelRequest(transaction)]);
          llmService.chat.mockClear();

          const updated = await categoryMappingService.finishDeferred(transaction, catalogue);

          expect(updated.category._id).toEqual(testExpenseCategory._id);
          expect(llmService.chat).not.toHaveBeenCalled();
        });

        it('passes the provider category through the same prefetch and lookup request', async () => {
          const transaction = await uncategorisable({
            description: 'מיקה מודיעין',
            rawData: {
              description: 'מיקה מודיעין',
              category: 'אנרגיה',
              chargedAmount: -250
            }
          });
          const catalogue = await llmCategorizer.forUser(testUserId);
          await categoryMappingService.attemptAutoCategorization(transaction, { catalogue, deferModel: true });

          llmService.__setChatResponse({
            content: JSON.stringify({
              answers: [{
                id: 1,
                category: 'Test Expense Category',
                subCategory: 'Test Expense SubCategory',
                confidence: 0.9
              }]
            })
          });
          await llmCategorizer.prefetch(catalogue, [categoryMappingService.toModelRequest(transaction)]);
          llmService.chat.mockClear();

          const updated = await categoryMappingService.finishDeferred(transaction, catalogue);

          expect(updated.category._id).toEqual(testExpenseCategory._id);
          expect(llmService.chat).not.toHaveBeenCalled();
        });

        // A transaction can also be deleted while the model is answering, and
        // saving the held document would either resurrect it or throw.
        it('skips a deferred transaction that was deleted while the model answered', async () => {
          const transaction = await uncategorisable();
          const catalogue = await llmCategorizer.forUser(testUserId);
          await categoryMappingService.attemptAutoCategorization(transaction, { catalogue, deferModel: true });
          await Transaction.deleteOne({ _id: transaction._id });

          const result = await categoryMappingService.finishDeferred(transaction, catalogue);

          expect(result).toBe(categoryMappingService.SKIPPED);
          expect(await Transaction.findById(transaction._id)).toBeNull();
        });

        it('gives a deferred transaction its default type when the model declines too', async () => {
          const transaction = await uncategorisable();
          const catalogue = await llmCategorizer.forUser(testUserId);
          llmService.__setChatResponse({ content: JSON.stringify({ category: null, confidence: 0 }) });

          await categoryMappingService.finishDeferred(transaction, catalogue);

          expect((await Transaction.findById(transaction._id)).type).toBe(TransactionType.EXPENSE);
        });

        it('records the current categorizer version after reconsidering a historical refusal', async () => {
          const created = await uncategorisable();
          await Transaction.updateOne(
            { _id: created._id },
            { $unset: { categorizationVersion: 1 } }
          );
          const transaction = await Transaction.findById(created._id);
          const catalogue = await llmCategorizer.forUser(testUserId);
          llmService.__setChatResponse({ content: JSON.stringify({ category: null, confidence: 0 }) });

          await categoryMappingService.finishDeferred(transaction, catalogue);

          expect(await Transaction.exists({
            _id: transaction._id,
            categorizationVersion: CURRENT_CATEGORIZATION_VERSION
          })).toBeTruthy();
        });

        it('does not save a current-version refusal when no field changed', async () => {
          const transaction = await uncategorisable({
            type: TransactionType.EXPENSE,
            categorizationVersion: CURRENT_CATEGORIZATION_VERSION
          });
          const catalogue = await llmCategorizer.forUser(testUserId);
          llmService.__setChatResponse({ content: JSON.stringify({ category: null, confidence: 0 }) });
          const save = jest.spyOn(Transaction.prototype, 'save');

          await categoryMappingService.finishDeferred(transaction, catalogue);

          expect(save).not.toHaveBeenCalled();
        });
      });

      // Nothing else ever revisits an uncategorised transaction - the queue is
      // fed only by newly-saved ones - so whatever the budget cuts off would be
      // abandoned for good unless it is written down here. The distinction
      // matters both ways: re-asking about one the model already declined would
      // spend the same money on the same refusal every single day.
      describe('recording what the budget cut off', () => {
        const spendTheBudget = () =>
          llmService.__setChatError(new AiBudgetExceededError(testUserId, 200000, 200000));

        it('marks a transaction the budget stopped the model from ever seeing', async () => {
          const created = await uncategorisable();
          await Transaction.updateOne(
            { _id: created._id },
            { $unset: { categorizationVersion: 1 } }
          );
          const transaction = await Transaction.findById(created._id);
          const catalogue = await llmCategorizer.forUser(testUserId);
          spendTheBudget();

          await categoryMappingService.finishDeferred(transaction, catalogue);

          const saved = await Transaction.findById(transaction._id);
          expect(saved.awaitingModelCategorization).toBe(true);
          expect(saved.category).toBeFalsy();
          // Still given everything a settled transaction gets, so the user sees
          // it in their list rather than it hiding until the model catches up.
          expect(saved.type).toBe(TransactionType.EXPENSE);
        });

        it('leaves a transaction the model looked at and declined unmarked', async () => {
          const transaction = await uncategorisable();
          const catalogue = await llmCategorizer.forUser(testUserId);
          llmService.__setChatResponse({ content: JSON.stringify({ category: null, confidence: 0 }) });

          await categoryMappingService.finishDeferred(transaction, catalogue);

          expect((await Transaction.findById(transaction._id)).awaitingModelCategorization).toBe(false);
        });

        it('clears the mark once the model has finally looked, even if it declines', async () => {
          const transaction = await uncategorisable({ awaitingModelCategorization: true });
          const catalogue = await llmCategorizer.forUser(testUserId);
          llmService.__setChatResponse({ content: JSON.stringify({ category: null, confidence: 0 }) });

          await categoryMappingService.finishDeferred(transaction, catalogue);

          expect((await Transaction.findById(transaction._id)).awaitingModelCategorization).toBe(false);
        });

        it('clears the mark when the model finally places it', async () => {
          const transaction = await uncategorisable({ awaitingModelCategorization: true });
          const catalogue = await llmCategorizer.forUser(testUserId);

          await categoryMappingService.finishDeferred(transaction, catalogue);

          const saved = await Transaction.findById(transaction._id);
          expect(saved.category).toBeTruthy();
          expect(saved.awaitingModelCategorization).toBe(false);
        });

        // A refusal the model already gave is an answer. Once the budget trips
        // later in the same run, every transaction sharing that description
        // would otherwise be marked unseen and re-asked on the next run - the
        // exact daily spend on hopeless descriptions this is meant to avoid.
        it('leaves one the model already declined alone when the budget trips later', async () => {
          const first = await uncategorisable({ description: 'מכולת פינתית' });
          const second = await uncategorisable({ description: 'מכולת פינתית' });
          const catalogue = await llmCategorizer.forUser(testUserId);
          llmService.__setChatResponse({ content: JSON.stringify({ category: null, confidence: 0 }) });

          await categoryMappingService.finishDeferred(first, catalogue);
          spendTheBudget();
          // Something else in the same run runs the budget out.
          await categoryMappingService.finishDeferred(await uncategorisable(), catalogue);

          await categoryMappingService.finishDeferred(second, catalogue);

          expect((await Transaction.findById(second._id)).awaitingModelCategorization).toBe(false);
        });

        // A transaction can also fall off the cliff without a batch around it.
        it('marks one the budget cut off on the single-call path too', async () => {
          const transaction = await uncategorisable();
          spendTheBudget();

          await categoryMappingService.attemptAutoCategorization(transaction);

          expect((await Transaction.findById(transaction._id)).awaitingModelCategorization).toBe(true);
        });

        // The model being down is not the same as the budget being spent: it
        // costs nothing, so there is no cliff to resume from, and marking it
        // would build a backlog that never drains.
        it('does not mark one the model simply failed to answer', async () => {
          const transaction = await uncategorisable();
          llmService.__setChatError(new Error('502 Bad Gateway'));

          await categoryMappingService.attemptAutoCategorization(transaction);

          expect((await Transaction.findById(transaction._id)).awaitingModelCategorization).toBe(false);
        });
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
