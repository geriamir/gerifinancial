const mongoose = require('mongoose');
const { User } = require('../../../auth');
const { BankAccount } = require('../../../banking');
const { Portfolio, Investment } = require('../../models');
const portfolioService = require('../portfolioService');
const { createTestUser } = require('../../../test/testUtils');

describe('closeStalePortfolios', () => {
  let testUser, bankAccount;

  beforeEach(async () => {
    const userData = await createTestUser(User, {
      email: 'invest-test@example.com',
      name: 'Investment Test User'
    });
    testUser = userData.user;

    bankAccount = await new BankAccount({
      userId: testUser._id,
      bankId: 'leumi',
      name: 'Leumi Investments',
      displayName: 'Leumi Investments',
      credentials: { username: 'test', password: 'test' }
    }).save();
  });

  afterEach(async () => {
    await Promise.all([
      User.deleteMany({}),
      BankAccount.deleteMany({}),
      Portfolio.deleteMany({}),
      Investment.deleteMany({})
    ]);
  });

  async function createActivePortfolio(portfolioId, opts = {}) {
    return Portfolio.create({
      userId: testUser._id,
      bankAccountId: bankAccount._id,
      portfolioId,
      portfolioName: opts.name || `Portfolio ${portfolioId}`,
      totalValue: opts.totalValue || 10000,
      currency: 'ILS',
      status: 'active'
    });
  }

  async function createActiveInvestment(portfolio, accountNumber) {
    return Investment.create({
      userId: testUser._id,
      bankAccountId: bankAccount._id,
      portfolioId: portfolio._id,
      accountNumber,
      balance: 5000,
      currency: 'ILS',
      status: 'active'
    });
  }

  it('should close portfolios not returned by scraper', async () => {
    const portfolio = await createActivePortfolio('PORT-001');

    // Scraper returns empty — user no longer has investments
    const result = await portfolioService.closeStalePortfolios([], bankAccount);

    expect(result.closedPortfolios).toBe(1);
    const updated = await Portfolio.findById(portfolio._id);
    expect(updated.status).toBe('closed');
  });

  it('should close investments under stale portfolios', async () => {
    const portfolio = await createActivePortfolio('PORT-001');
    await createActiveInvestment(portfolio, 'INV-001');
    await createActiveInvestment(portfolio, 'INV-002');

    const result = await portfolioService.closeStalePortfolios([], bankAccount);

    expect(result.closedPortfolios).toBe(1);
    expect(result.closedInvestments).toBe(2);

    const investments = await Investment.find({ portfolioId: portfolio._id });
    investments.forEach(inv => expect(inv.status).toBe('closed'));
  });

  it('should NOT close portfolios that are still returned by scraper', async () => {
    const portfolio = await createActivePortfolio('PORT-001');
    await createActiveInvestment(portfolio, 'INV-001');

    // Scraper returns this portfolio
    const scrapedPortfolios = [{ portfolioId: 'PORT-001', investments: [] }];
    const result = await portfolioService.closeStalePortfolios(scrapedPortfolios, bankAccount);

    expect(result.closedPortfolios).toBe(0);
    expect(result.closedInvestments).toBe(0);

    const updated = await Portfolio.findById(portfolio._id);
    expect(updated.status).toBe('active');
  });

  it('should only close the missing portfolio when some remain', async () => {
    const kept = await createActivePortfolio('PORT-KEEP');
    const removed = await createActivePortfolio('PORT-GONE');
    await createActiveInvestment(kept, 'INV-K1');
    await createActiveInvestment(removed, 'INV-G1');
    await createActiveInvestment(removed, 'INV-G2');

    const scrapedPortfolios = [{ portfolioId: 'PORT-KEEP', investments: [] }];
    const result = await portfolioService.closeStalePortfolios(scrapedPortfolios, bankAccount);

    expect(result.closedPortfolios).toBe(1);
    expect(result.closedInvestments).toBe(2);

    expect((await Portfolio.findById(kept._id)).status).toBe('active');
    expect((await Portfolio.findById(removed._id)).status).toBe('closed');
    expect((await Investment.findOne({ accountNumber: 'INV-K1' })).status).toBe('active');
    expect((await Investment.findOne({ accountNumber: 'INV-G1' })).status).toBe('closed');
  });

  it('should not affect portfolios from a different bank account', async () => {
    const otherBank = await new BankAccount({
      userId: testUser._id,
      bankId: 'hapoalim',
      name: 'Hapoalim',
      displayName: 'Hapoalim',
      credentials: { username: 'test', password: 'test' }
    }).save();

    // Portfolio on the other bank
    const otherPortfolio = await Portfolio.create({
      userId: testUser._id,
      bankAccountId: otherBank._id,
      portfolioId: 'OTHER-001',
      portfolioName: 'Other Portfolio',
      totalValue: 5000,
      currency: 'ILS',
      status: 'active'
    });

    // Leumi portfolio that will go stale
    await createActivePortfolio('LEUMI-001');

    // Scrape Leumi with empty results
    const result = await portfolioService.closeStalePortfolios([], bankAccount);

    expect(result.closedPortfolios).toBe(1);
    // Other bank's portfolio should be untouched
    expect((await Portfolio.findById(otherPortfolio._id)).status).toBe('active');
  });

  it('should not close already-closed portfolios', async () => {
    await Portfolio.create({
      userId: testUser._id,
      bankAccountId: bankAccount._id,
      portfolioId: 'PORT-OLD',
      portfolioName: 'Already Closed',
      totalValue: 0,
      currency: 'ILS',
      status: 'closed'
    });

    const result = await portfolioService.closeStalePortfolios([], bankAccount);

    // Already closed — should not be counted
    expect(result.closedPortfolios).toBe(0);
  });

  it('should handle null/undefined scrapedPortfolios gracefully', async () => {
    await createActivePortfolio('PORT-001');

    const resultNull = await portfolioService.closeStalePortfolios(null, bankAccount);
    expect(resultNull.closedPortfolios).toBe(1);

    // Reset for next test
    await Portfolio.updateMany({}, { status: 'active' });

    const resultUndefined = await portfolioService.closeStalePortfolios(undefined, bankAccount);
    expect(resultUndefined.closedPortfolios).toBe(1);
  });
});
