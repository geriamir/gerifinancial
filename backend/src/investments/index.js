// Investments subsystem public interface

// Models (used by other subsystems)
const { StockPrice, Investment, InvestmentSnapshot, InvestmentTransaction, Portfolio, PortfolioSnapshot } = require('./models');

// Services (used by other subsystems)
const investmentService = require('./services/investmentService');
const portfolioService = require('./services/portfolioService');

module.exports = {
  // Models
  StockPrice,
  Investment,
  InvestmentSnapshot,
  InvestmentTransaction,
  Portfolio,
  PortfolioSnapshot,
  
  // Services
  investmentService,
  portfolioService
};
