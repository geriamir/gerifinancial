const request = require('supertest');
const mongoose = require('mongoose');
const { createTestUser } = require('../../test/testUtils');
const app = require('../../app');
const { User, RSUGrant, RSUSale } = require('../../models');

let testUser;
let authToken;

beforeEach(async () => {
  // Create test user
  const testData = await createTestUser(User, {
    email: 'rsu-routes-test@example.com',
    name: 'RSU Routes Test User'
  });
  testUser = testData.user;
  authToken = testData.token;
});

afterAll(async () => {
  // Clean up test data
  try {
    if (testUser) {
      await RSUSale.deleteMany({ userId: testUser._id });
      await RSUGrant.deleteMany({ userId: testUser._id });
      await User.deleteOne({ _id: testUser._id });
    }
  } catch (error) {
    console.log('Cleanup error (ignored):', error.message);
  }
});

describe('RSU API Endpoints', () => {
  
  describe('Grant Management Endpoints', () => {
    
    describe('POST /api/rsus/grants', () => {
      it('should create a new RSU grant', async () => {
        const grantData = {
          stockSymbol: 'MSFT',
          name: 'Microsoft Grant 2024',
          company: 'Microsoft Corporation',
          grantDate: '2024-01-15',
          totalValue: 100000,
          totalShares: 1000,
          notes: 'Initial grant'
        };

        const response = await request(app)
          .post('/api/rsus/grants')
          .set('Authorization', `Bearer ${authToken}`)
          .send(grantData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.stockSymbol).toBe('MSFT');
        expect(response.body.data.name).toBe('Microsoft Grant 2024');
        expect(response.body.data.totalValue).toBe(100000);
        expect(response.body.data.totalShares).toBe(1000);
        expect(response.body.data.vestingSchedule).toHaveLength(20);
        expect(response.body.message).toBe('RSU grant created successfully');
      });

      it('should validate required fields', async () => {
        const invalidData = {
          stockSymbol: '', // Invalid
          grantDate: '2024-01-15',
          totalValue: 100000
          // Missing totalShares
        };

        const response = await request(app)
          .post('/api/rsus/grants')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Validation failed');
      });

      it('should validate positive amounts', async () => {
        const invalidData = {
          stockSymbol: 'MSFT',
          grantDate: '2024-01-15',
          totalValue: -1000, // Invalid
          totalShares: 1000
        };

        const response = await request(app)
          .post('/api/rsus/grants')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidData)
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should validate stock symbol length', async () => {
        const invalidData = {
          stockSymbol: 'TOOLONGSTOCKSYMBOL', // Too long
          grantDate: '2024-01-15',
          totalValue: 100000,
          totalShares: 1000
        };

        const response = await request(app)
          .post('/api/rsus/grants')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidData)
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/rsus/grants', () => {
      beforeEach(async () => {
        // Create test grants
        await RSUGrant.create([
          {
            userId: testUser._id,
            stockSymbol: 'MSFT',
            grantDate: new Date('2024-01-01'),
            totalValue: 100000,
            totalShares: 1000,
            pricePerShare: 100,
            status: 'active',
            vestingSchedule: [{
              vestDate: new Date('2024-04-01'),
              shares: 250,
              vested: false,
              vestedValue: 0
            }]
          },
          {
            userId: testUser._id,
            stockSymbol: 'AAPL',
            grantDate: new Date('2024-02-01'),
            totalValue: 50000,
            totalShares: 500,
            pricePerShare: 100,
            status: 'completed',
            vestingSchedule: [{
              vestDate: new Date('2024-05-01'),
              shares: 125,
              vested: true,
              vestedValue: 15000
            }]
          }
        ]);
      });

      it('should return all grants for user', async () => {
        const response = await request(app)
          .get('/api/rsus/grants')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(2);
      });

      it('should filter by status', async () => {
        const response = await request(app)
          .get('/api/rsus/grants?status=active')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].stockSymbol).toBe('MSFT');
      });

      it('should filter by stock symbol', async () => {
        const response = await request(app)
          .get('/api/rsus/grants?stockSymbol=AAPL')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].stockSymbol).toBe('AAPL');
      });
    });

    describe('GET /api/rsus/grants/:id', () => {
      let testGrant;

      beforeEach(async () => {
        testGrant = await RSUGrant.create({
          userId: testUser._id,
          stockSymbol: 'MSFT',
          grantDate: new Date('2024-01-01'),
          totalValue: 100000,
          totalShares: 1000,
          pricePerShare: 100,
          status: 'active',
          vestingSchedule: [{
            vestDate: new Date('2024-04-01'),
            shares: 250,
            vested: false,
            vestedValue: 0
          }]
        });
      });

      it('should return specific grant', async () => {
        const response = await request(app)
          .get(`/api/rsus/grants/${testGrant._id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.stockSymbol).toBe('MSFT');
      });

      it('should return 404 for non-existent grant', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        
        const response = await request(app)
          .get(`/api/rsus/grants/${fakeId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Grant not found');
      });

      it('should return 400 for invalid ID format', async () => {
        const response = await request(app)
          .get('/api/rsus/grants/invalid-id')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('PUT /api/rsus/grants/:id', () => {
      let testGrant;

      beforeEach(async () => {
        testGrant = await RSUGrant.create({
          userId: testUser._id,
          stockSymbol: 'MSFT',
          grantDate: new Date('2024-01-01'),
          totalValue: 100000,
          totalShares: 1000,
          pricePerShare: 100,
          status: 'active',
          vestingSchedule: [{
            vestDate: new Date('2024-04-01'),
            shares: 250,
            vested: false,
            vestedValue: 0
          }]
        });
      });

      it('should update grant successfully', async () => {
        const updates = {
          name: 'Updated Grant Name',
          company: 'Updated Company',
          notes: 'Updated notes'
        };

        const response = await request(app)
          .put(`/api/rsus/grants/${testGrant._id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updates)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe('Updated Grant Name');
        expect(response.body.data.company).toBe('Updated Company');
        expect(response.body.message).toBe('Grant updated successfully');
      });

      it('should validate update data', async () => {
        const invalidUpdates = {
          totalValue: -1000 // Invalid
        };

        const response = await request(app)
          .put(`/api/rsus/grants/${testGrant._id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidUpdates)
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('DELETE /api/rsus/grants/:id', () => {
      let testGrant;
      let testSale;

      beforeEach(async () => {
        testGrant = await RSUGrant.create({
          userId: testUser._id,
          stockSymbol: 'MSFT',
          grantDate: new Date('2024-01-01'),
          totalValue: 100000,
          totalShares: 1000,
          pricePerShare: 100,
          status: 'active',
          vestingSchedule: [{
            vestDate: new Date('2024-04-01'),
            shares: 250,
            vested: true,
            vestedValue: 30000
          }]
        });

        testSale = await RSUSale.create({
          userId: testUser._id,
          grantId: testGrant._id,
          saleDate: new Date('2024-06-01'),
          sharesAmount: 100,
          pricePerShare: 120,
          totalSaleValue: 12000,
          taxCalculation: {
            originalValue: 10000,
            profit: 2000,
            isLongTerm: false,
            wageIncomeTax: 6500,
            capitalGainsTax: 1300,
            totalTax: 7800,
            netValue: 4200,
            taxBasis: {
              grantValue: 10000,
              saleValue: 12000,
              profitAmount: 2000,
              taxRateApplied: 0.65
            }
          }
        });
      });

      it('should delete grant and associated sales', async () => {
        const response = await request(app)
          .delete(`/api/rsus/grants/${testGrant._id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.deletedGrant).toBe(true);
        expect(response.body.data.deletedSales).toBe(1);
        expect(response.body.message).toBe('Grant and associated sales deleted successfully');

        // Verify deletion
        const deletedGrant = await RSUGrant.findById(testGrant._id);
        const deletedSale = await RSUSale.findById(testSale._id);
        expect(deletedGrant).toBeNull();
        expect(deletedSale).toBeNull();
      });
    });
  });

  describe('Sales Management Endpoints', () => {
    let testGrant;

    beforeEach(async () => {
      testGrant = await RSUGrant.create({
        userId: testUser._id,
        stockSymbol: 'MSFT',
        grantDate: new Date('2022-01-01'), // 2+ years ago for long-term testing
        totalValue: 100000,
        totalShares: 1000,
        pricePerShare: 100,
        status: 'active',
        vestingSchedule: [
          { vestDate: new Date('2023-01-01'), shares: 250, vested: true, vestedValue: 30000 },
          { vestDate: new Date('2023-04-01'), shares: 250, vested: true, vestedValue: 32000 }
        ]
      });
    });

    describe('POST /api/rsus/sales', () => {
      it('should record a new sale', async () => {
        const saleData = {
          grantId: testGrant._id,
          saleDate: '2024-01-15',
          sharesAmount: 100,
          pricePerShare: 150,
          notes: 'First sale'
        };

        const response = await request(app)
          .post('/api/rsus/sales')
          .set('Authorization', `Bearer ${authToken}`)
          .send(saleData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.sharesAmount).toBe(100);
        expect(response.body.data.pricePerShare).toBe(150);
        expect(response.body.data.totalSaleValue).toBe(15000);
        expect(response.body.data.taxCalculation).toBeDefined();
        expect(response.body.message).toBe('RSU sale recorded successfully');
      });

      it('should validate required fields', async () => {
        const invalidData = {
          grantId: testGrant._id,
          // Missing required fields
        };

        const response = await request(app)
          .post('/api/rsus/sales')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Validation failed');
      });

      it('should validate share availability', async () => {
        const invalidData = {
          grantId: testGrant._id,
          saleDate: '2024-01-15',
          sharesAmount: 1000, // More than available
          pricePerShare: 150
        };

        const response = await request(app)
          .post('/api/rsus/sales')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidData)
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should validate grant ownership', async () => {
        // Create grant for different user
        const otherUser = await User.create({
          email: 'other@example.com',
          name: 'Other User',
          password: 'password123'
        });

        const otherGrant = await RSUGrant.create({
          userId: otherUser._id,
          stockSymbol: 'AAPL',
          grantDate: new Date('2024-01-01'),
          totalValue: 50000,
          totalShares: 500,
          pricePerShare: 100,
          status: 'active',
          vestingSchedule: [{
            vestDate: new Date('2024-04-01'),
            shares: 125,
            vested: false,
            vestedValue: 0
          }]
        });

        const saleData = {
          grantId: otherGrant._id,
          saleDate: '2024-01-15',
          sharesAmount: 100,
          pricePerShare: 150
        };

        const response = await request(app)
          .post('/api/rsus/sales')
          .set('Authorization', `Bearer ${authToken}`)
          .send(saleData)
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Grant not found');
      });
    });

    describe('GET /api/rsus/sales', () => {
      beforeEach(async () => {
        // Create test sales
        await RSUSale.create([
          {
            userId: testUser._id,
            grantId: testGrant._id,
            saleDate: new Date('2024-01-15'),
            sharesAmount: 100,
            pricePerShare: 150,
            totalSaleValue: 15000,
            taxCalculation: {
              originalValue: 10000,
              profit: 5000,
              isLongTerm: true,
              wageIncomeTax: 6500,
              capitalGainsTax: 1250,
              totalTax: 7750,
              netValue: 7250,
              taxBasis: { grantValue: 10000, saleValue: 15000, profitAmount: 5000, taxRateApplied: 0.517 }
            }
          },
          {
            userId: testUser._id,
            grantId: testGrant._id,
            saleDate: new Date('2024-02-15'),
            sharesAmount: 50,
            pricePerShare: 160,
            totalSaleValue: 8000,
            taxCalculation: {
              originalValue: 5000,
              profit: 3000,
              isLongTerm: true,
              wageIncomeTax: 3250,
              capitalGainsTax: 750,
              totalTax: 4000,
              netValue: 4000,
              taxBasis: { grantValue: 5000, saleValue: 8000, profitAmount: 3000, taxRateApplied: 0.50 }
            }
          }
        ]);
      });

      it('should return all sales for user', async () => {
        const response = await request(app)
          .get('/api/rsus/sales')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(2);
      });

      it('should filter by grant ID', async () => {
        const response = await request(app)
          .get(`/api/rsus/sales?grantId=${testGrant._id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(2);
      });

      it('should filter by date range', async () => {
        const response = await request(app)
          .get('/api/rsus/sales?startDate=2024-01-01&endDate=2024-01-31')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].sharesAmount).toBe(100);
      });
    });
  });

  describe('Portfolio & Analytics Endpoints', () => {
    beforeEach(async () => {
      // Create test grants
      await RSUGrant.create([
        {
          userId: testUser._id,
          stockSymbol: 'MSFT',
          grantDate: new Date('2023-01-01'),
          totalValue: 100000,
          totalShares: 1000,
          pricePerShare: 100,
          currentPrice: 120,
          status: 'active',
          vestingSchedule: [
            { vestDate: new Date('2024-01-01'), shares: 250, vested: true, vestedValue: 30000 }
          ]
        },
        {
          userId: testUser._id,
          stockSymbol: 'AAPL',
          grantDate: new Date('2023-06-01'),
          totalValue: 50000,
          totalShares: 500,
          pricePerShare: 100,
          currentPrice: 180,
          status: 'active',
          vestingSchedule: [
            { vestDate: new Date('2024-06-01'), shares: 125, vested: false, vestedValue: 0 }
          ]
        }
      ]);
    });

    describe('GET /api/rsus/portfolio', () => {
      it('should return portfolio summary', async () => {
        const response = await request(app)
          .get('/api/rsus/portfolio')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.grants).toBeDefined();
        expect(response.body.data.vesting).toBeDefined();
        expect(response.body.data.sales).toBeDefined();
        expect(response.body.data.summary).toBeDefined();
      });
    });

    describe('GET /api/rsus/performance', () => {
      it('should return performance metrics', async () => {
        const response = await request(app)
          .get('/api/rsus/performance?timeframe=1Y')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.timeframe).toBe('1Y');
      });
    });

    describe('GET /api/rsus/vesting/upcoming', () => {
      it('should return upcoming vesting events', async () => {
        const response = await request(app)
          .get('/api/rsus/vesting/upcoming?days=90')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(Array.isArray(response.body.data)).toBe(true);
      });
    });
  });

  describe('Tax Calculation Endpoints', () => {
    let testGrant;

    beforeEach(async () => {
      testGrant = await RSUGrant.create({
        userId: testUser._id,
        stockSymbol: 'MSFT',
        grantDate: new Date('2022-01-01'),
        totalValue: 100000,
        totalShares: 1000,
        pricePerShare: 100,
        status: 'active',
        vestingSchedule: [
          { vestDate: new Date('2023-01-01'), shares: 250, vested: true, vestedValue: 30000 }
        ]
      });
    });

    describe('POST /api/rsus/tax/preview', () => {
      it('should return tax preview for potential sale', async () => {
        const previewData = {
          grantId: testGrant._id,
          sharesAmount: 100,
          salePrice: 150
        };

        const response = await request(app)
          .post('/api/rsus/tax/preview')
          .set('Authorization', `Bearer ${authToken}`)
          .send(previewData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.grantInfo).toBeDefined();
        expect(response.body.data.saleInfo).toBeDefined();
        expect(response.body.data.taxCalculation).toBeDefined();
      });

      it('should validate grant ownership for tax preview', async () => {
        const otherUser = await User.create({
          email: 'other2@example.com',
          name: 'Other User 2',
          password: 'password123'
        });

        const otherGrant = await RSUGrant.create({
          userId: otherUser._id,
          stockSymbol: 'AAPL',
          grantDate: new Date('2024-01-01'),
          totalValue: 50000,
          totalShares: 500,
          pricePerShare: 100,
          status: 'active',
          vestingSchedule: [{
            vestDate: new Date('2024-04-01'),
            shares: 125,
            vested: false,
            vestedValue: 0
          }]
        });

        const previewData = {
          grantId: otherGrant._id,
          sharesAmount: 100,
          salePrice: 150
        };

        const response = await request(app)
          .post('/api/rsus/tax/preview')
          .set('Authorization', `Bearer ${authToken}`)
          .send(previewData)
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Grant not found');
      });
    });

    describe('GET /api/rsus/tax/projections', () => {
      it('should return tax projections for year', async () => {
        const response = await request(app)
          .get('/api/rsus/tax/projections?year=2024')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
      });
    });

    describe('GET /api/rsus/tax/summary/:year', () => {
      it('should return annual tax summary', async () => {
        const response = await request(app)
          .get('/api/rsus/tax/summary/2024')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
      });
    });
  });

  describe('Authentication & Authorization', () => {
    it('should require authentication for all endpoints', async () => {
      await request(app)
        .get('/api/rsus/grants')
        .expect(401);

      await request(app)
        .post('/api/rsus/grants')
        .send({ stockSymbol: 'MSFT' })
        .expect(401);

      await request(app)
        .get('/api/rsus/portfolio')
        .expect(401);

      await request(app)
        .post('/api/rsus/sales')
        .send({ grantId: 'test' })
        .expect(401);
    });

    it('should validate MongoDB ObjectId format', async () => {
      await request(app)
        .get('/api/rsus/grants/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      await request(app)
        .put('/api/rsus/grants/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'test' })
        .expect(400);

      await request(app)
        .delete('/api/rsus/grants/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should prevent access to other users data', async () => {
      // Create another user
      const otherUser = await User.create({
        email: 'other3@example.com',
        name: 'Other User 3',
        password: 'password123'
      });

      // Create grant for other user
      const otherGrant = await RSUGrant.create({
        userId: otherUser._id,
        stockSymbol: 'GOOGL',
        grantDate: new Date('2024-01-01'),
        totalValue: 75000,
        totalShares: 750,
        pricePerShare: 100,
        status: 'active',
        vestingSchedule: [{
          vestDate: new Date('2024-04-01'),
          shares: 187,
          vested: false,
          vestedValue: 0
        }]
      });

      // Try to access other user's grant
      const response = await request(app)
        .get(`/api/rsus/grants/${otherGrant._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Grant not found');
    });
  });
});
