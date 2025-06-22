const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const BankAccount = require('../../models/BankAccount');

describe('Bank Account Routes', () => {
  let token;
  let user;

  beforeEach(async () => {
    user = await createTestUser(User);
    token = generateTestToken(user._id);
  });

  describe('POST /api/bank-accounts', () => {
    it('should create a new bank account', async () => {
      const bankData = {
        bankId: 'hapoalim',
        name: 'Personal Account',
        credentials: {
          username: 'testuser',
          password: 'bankpass123'
        }
      };

      const response = await request(app)
        .post('/api/bank-accounts')
        .set('Authorization', `Bearer ${token}`)
        .send(bankData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('name', bankData.name);
      expect(response.body).toHaveProperty('bankId', bankData.bankId);
      expect(response.body).not.toHaveProperty('credentials');
      expect(response.body).toHaveProperty('userId', user._id.toString());

      // Verify account was saved to database
      const savedAccount = await BankAccount.findOne({ userId: user._id });
      expect(savedAccount).toBeTruthy();
      expect(savedAccount.name).toBe(bankData.name);
      expect(savedAccount.credentials.password).not.toBe(bankData.credentials.password); // Should be encrypted
    });

    it('should not create bank account without authentication', async () => {
      const response = await request(app)
        .post('/api/bank-accounts')
        .send({
          bankId: 'hapoalim',
          name: 'Personal Account',
          credentials: {
            username: 'testuser',
            password: 'bankpass123'
          }
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/bank-accounts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bankId: 'hapoalim',
          name: 'Personal Account'
          // Missing credentials
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/bank-accounts', () => {
    beforeEach(async () => {
      // Create some test bank accounts
      await BankAccount.create([
        {
          userId: user._id,
          bankId: 'hapoalim',
          name: 'Personal Account',
          credentials: {
            username: 'testuser1',
            password: 'encrypted1'
          }
        },
        {
          userId: user._id,
          bankId: 'leumi',
          name: 'Business Account',
          credentials: {
            username: 'testuser2',
            password: 'encrypted2'
          }
        }
      ]);
    });

    it('should list user\'s bank accounts', async () => {
      const response = await request(app)
        .get('/api/bank-accounts')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('name', 'Personal Account');
      expect(response.body[1]).toHaveProperty('name', 'Business Account');
      // Verify sensitive data is not returned
      expect(response.body[0]).not.toHaveProperty('credentials');
      expect(response.body[1]).not.toHaveProperty('credentials');
    });

    it('should not list accounts without authentication', async () => {
      const response = await request(app)
        .get('/api/bank-accounts');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should only list accounts for authenticated user', async () => {
      // Create another user with their own account
      const otherUser = await createTestUser(User, {
        email: 'other@example.com'
      });
      await BankAccount.create({
        userId: otherUser._id,
        bankId: 'discount',
        name: 'Other Account',
        credentials: {
          username: 'otheruser',
          password: 'encrypted3'
        }
      });

      const response = await request(app)
        .get('/api/bank-accounts')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2); // Only original user's accounts
      expect(response.body.every(account => account.userId === user._id.toString())).toBe(true);
    });
  });

  describe('DELETE /api/bank-accounts/:id', () => {
    let accountId;

    beforeEach(async () => {
      // Create a test bank account
      const account = await BankAccount.create({
        userId: user._id,
        bankId: 'hapoalim',
        name: 'Test Account',
        credentials: {
          username: 'testuser',
          password: 'encrypted'
        }
      });
      accountId = account._id;
    });

    it('should delete bank account', async () => {
      const response = await request(app)
        .delete(`/api/bank-accounts/${accountId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');

      // Verify account was deleted
      const deletedAccount = await BankAccount.findById(accountId);
      expect(deletedAccount).toBeNull();
    });

    it('should not delete account without authentication', async () => {
      const response = await request(app)
        .delete(`/api/bank-accounts/${accountId}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');

      // Verify account still exists
      const account = await BankAccount.findById(accountId);
      expect(account).toBeTruthy();
    });

    it('should not delete another user\'s account', async () => {
      // Create another user with their own account
      const otherUser = await createTestUser(User, {
        email: 'other@example.com'
      });
      const otherAccount = await BankAccount.create({
        userId: otherUser._id,
        bankId: 'discount',
        name: 'Other Account',
        credentials: {
          username: 'otheruser',
          password: 'encrypted'
        }
      });

      const response = await request(app)
        .delete(`/api/bank-accounts/${otherAccount._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');

      // Verify account still exists
      const account = await BankAccount.findById(otherAccount._id);
      expect(account).toBeTruthy();
    });
  });
});
