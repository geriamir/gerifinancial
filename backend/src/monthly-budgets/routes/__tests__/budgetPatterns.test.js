const request = require('supertest');
const mongoose = require('mongoose');
const { createTestUser } = require('../../../test/testUtils');
const app = require('../../../app');
const { User } = require('../../../auth');
const { Category, SubCategory } = require('../../../banking');
const TransactionPattern = require('../../models/TransactionPattern');

let testUser;
let authToken;
let testCategory;
let testSubCategory;

beforeEach(async () => {
  // Create test user using testUtils (in beforeEach because beforeEach clears DB)
  const testData = await createTestUser(User, {
    email: 'pattern-test@example.com',
    name: 'Pattern Test User'
  });
  testUser = testData.user;
  authToken = testData.token;
  
  // Create test category and subcategory
  testCategory = new Category({
    name: 'Test Expenses',
    type: 'Expense',
    userId: testUser._id
  });
  await testCategory.save();
  
  testSubCategory = new SubCategory({
    name: 'Test Municipal',
    parentCategory: testCategory._id,
    userId: testUser._id
  });
  await testSubCategory.save();
});

afterAll(async () => {
  // Clean up test data - use try-catch in case connection is closed
  try {
    if (testUser) {
      await TransactionPattern.deleteMany({ userId: testUser._id });
      await SubCategory.deleteOne({ _id: testSubCategory._id });
      await Category.deleteOne({ _id: testCategory._id });
      await User.deleteOne({ _id: testUser._id });
    }
  } catch (error) {
    // Ignore cleanup errors - likely due to connection being closed
    console.log('Cleanup error (ignored):', error.message);
  }
});

describe('Budget Pattern API Endpoints', () => {

  describe('GET /api/budgets/patterns/detected/:userId', () => {
    test('should return pending patterns for user', async () => {
      // Create a test pattern
      const testPattern = new TransactionPattern({
        patternId: 'test-uuid-1',
        userId: testUser._id,
        transactionIdentifier: {
          description: 'Municipal Tax',
          categoryId: testCategory._id,
          subCategoryId: testSubCategory._id,
          amountRange: { min: 440, max: 460 }
        },
        averageAmount: 450,
        recurrencePattern: 'bi-monthly',
        detectionData: {
          confidence: 0.9,
          lastDetected: new Date(),
          analysisMonths: 6,
          sampleTransactions: []
        },
        scheduledMonths: [1, 3, 5],
        approvalStatus: 'pending'
      });
      await testPattern.save();

      const response = await request(app)
        .get(`/api/budgets/patterns/detected/${testUser._id.toString()}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.patterns).toHaveLength(1);
      expect(response.body.data.patterns[0].description).toBe('Municipal Tax');
      expect(response.body.data.patterns[0].patternType).toBe('bi-monthly');
      expect(response.body.data.totalCount).toBe(1);
    });

    test('should deny access to other user patterns', async () => {
      const otherUserId = new mongoose.Types.ObjectId();
      
      await request(app)
        .get(`/api/budgets/patterns/detected/${otherUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });

    test('should validate userId parameter', async () => {
      await request(app)
        .get('/api/budgets/patterns/detected/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('POST /api/budgets/patterns/approve', () => {
    test('should approve a pattern successfully', async () => {
      // Create a test pattern
      const testPattern = new TransactionPattern({
        patternId: 'test-uuid-2',
        userId: testUser._id,
        transactionIdentifier: {
          description: 'Municipal Tax',
          categoryId: testCategory._id,
          subCategoryId: testSubCategory._id,
          amountRange: { min: 440, max: 460 }
        },
        averageAmount: 450,
        recurrencePattern: 'bi-monthly',
        detectionData: {
          confidence: 0.9,
          lastDetected: new Date(),
          analysisMonths: 6,
          sampleTransactions: []
        },
        scheduledMonths: [1, 3, 5],
        approvalStatus: 'pending'
      });
      await testPattern.save();

      const response = await request(app)
        .post('/api/budgets/patterns/approve')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ patternId: testPattern._id })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Pattern approved successfully');
      
      // Verify pattern was approved
      const updatedPattern = await TransactionPattern.findById(testPattern._id);
      expect(updatedPattern.approvalStatus).toBe('approved');
      expect(updatedPattern.isActive).toBe(true);
    });

    test('should return 404 for non-existent pattern', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      await request(app)
        .post('/api/budgets/patterns/approve')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ patternId: nonExistentId })
        .expect(404);
    });

    test('should deny access to other user patterns', async () => {
      // Create pattern for another user
      const otherUserId = new mongoose.Types.ObjectId();
      const otherPattern = new TransactionPattern({
        patternId: 'test-uuid-3',
        userId: otherUserId,
        transactionIdentifier: {
          description: 'Other Tax',
          categoryId: testCategory._id,
          subCategoryId: testSubCategory._id,
          amountRange: { min: 440, max: 460 }
        },
        averageAmount: 450,
        recurrencePattern: 'bi-monthly',
        detectionData: {
          confidence: 0.9,
          lastDetected: new Date(),
          analysisMonths: 6,
          sampleTransactions: []
        },
        scheduledMonths: [1, 3, 5],
        approvalStatus: 'pending'
      });
      await otherPattern.save();

      await request(app)
        .post('/api/budgets/patterns/approve')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ patternId: otherPattern._id })
        .expect(403);
    });

    test('should validate patternId parameter', async () => {
      await request(app)
        .post('/api/budgets/patterns/approve')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ patternId: 'invalid-id' })
        .expect(400);
    });
  });

  describe('POST /api/budgets/patterns/reject', () => {
    test('should reject a pattern successfully', async () => {
      // Create a test pattern
      const testPattern = new TransactionPattern({
        patternId: 'test-uuid-4',
        userId: testUser._id,
        transactionIdentifier: {
          description: 'Municipal Tax',
          categoryId: testCategory._id,
          subCategoryId: testSubCategory._id,
          amountRange: { min: 440, max: 460 }
        },
        averageAmount: 450,
        recurrencePattern: 'bi-monthly',
        detectionData: {
          confidence: 0.9,
          lastDetected: new Date(),
          analysisMonths: 6,
          sampleTransactions: []
        },
        scheduledMonths: [1, 3, 5],
        approvalStatus: 'pending'
      });
      await testPattern.save();

      const response = await request(app)
        .post('/api/budgets/patterns/reject')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ 
          patternId: testPattern._id,
          reason: 'Not a regular expense'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Pattern rejected successfully');
      
      // Verify pattern was rejected
      const updatedPattern = await TransactionPattern.findById(testPattern._id);
      expect(updatedPattern.approvalStatus).toBe('rejected');
      expect(updatedPattern.isActive).toBe(false);
      expect(updatedPattern.notes).toBe('Not a regular expense');
    });

    test('should validate patternId parameter', async () => {
      await request(app)
        .post('/api/budgets/patterns/reject')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ patternId: 'invalid-id' })
        .expect(400);
    });
  });

  describe('GET /api/budgets/patterns/preview/:year/:month', () => {
    test('should return pattern preview for month', async () => {
      // Create an approved pattern that affects January
      const testPattern = new TransactionPattern({
        patternId: 'test-uuid-5',
        userId: testUser._id,
        transactionIdentifier: {
          description: 'Municipal Tax',
          categoryId: testCategory._id,
          subCategoryId: testSubCategory._id,
          amountRange: { min: 440, max: 460 }
        },
        averageAmount: 450,
        recurrencePattern: 'bi-monthly',
        detectionData: {
          confidence: 0.9,
          lastDetected: new Date(),
          analysisMonths: 6,
          sampleTransactions: []
        },
        scheduledMonths: [1, 3, 5],
        approvalStatus: 'approved',
        isActive: true
      });
      await testPattern.save();

      const response = await request(app)
        .get('/api/budgets/patterns/preview/2025/1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.month).toBe(1);
      expect(response.body.data.year).toBe(2025);
      expect(response.body.data.monthName).toBe('January');
      expect(response.body.data.patterns).toHaveLength(1);
      expect(response.body.data.totalPatternAmount).toBe(450);
      expect(response.body.data.hasPatterns).toBe(true);
    });

    test('should handle month with no patterns', async () => {
      const response = await request(app)
        .get('/api/budgets/patterns/preview/2025/2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.patterns).toHaveLength(0);
      expect(response.body.data.totalPatternAmount).toBe(0);
      expect(response.body.data.hasPatterns).toBe(false);
    });

    test('should validate year and month parameters', async () => {
      await request(app)
        .get('/api/budgets/patterns/preview/invalid/1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      await request(app)
        .get('/api/budgets/patterns/preview/2025/13')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      await request(app)
        .get('/api/budgets/patterns/preview/2025/0')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('Authentication and validation', () => {
    test('should require authentication for all endpoints', async () => {
      await request(app)
        .get(`/api/budgets/patterns/detected/${testUser._id}`)
        .expect(401);

      await request(app)
        .post('/api/budgets/patterns/approve')
        .send({ patternId: new mongoose.Types.ObjectId() })
        .expect(401);

      await request(app)
        .get('/api/budgets/patterns/preview/2025/1')
        .expect(401);
    });

    test('should validate required parameters', async () => {
      // Missing patternId
      await request(app)
        .post('/api/budgets/patterns/approve')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      // Invalid ObjectId format
      await request(app)
        .post('/api/budgets/patterns/approve')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ patternId: 'invalid' })
        .expect(400);
    });
  });
});
