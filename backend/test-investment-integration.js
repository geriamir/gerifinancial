// Simple test script to verify investment integration
const dataSyncService = require('./src/services/dataSyncService');
const investmentService = require('./src/services/investmentService');
const bankScraperService = require('./src/services/bankScraperService');

console.log('Testing Investment Integration...\n');

// Test 1: Check if services are properly loaded
console.log('✓ DataSync Service loaded:', typeof dataSyncService.syncBankAccountData === 'function');
console.log('✓ Investment Service loaded:', typeof investmentService.processScrapedInvestments === 'function');
console.log('✓ Bank Scraper Service loaded:', typeof bankScraperService.processInvestmentData === 'function');

// Test 2: Check scraper info includes investment capability
const scraperInfo = bankScraperService.getScraperInfo();
console.log('\n✓ Scraper Info:', scraperInfo);

// Test 3: Test investment data processing with mock data
console.log('\nTesting investment data processing...');

const mockInvestmentData = [
  {
    accountNumber: 'INV-123456',
    accountType: 'investment',
    balance: 50000,
    currency: 'ILS',
    holdings: [
      {
        symbol: 'TEVA',
        name: 'Teva Pharmaceutical Industries',
        quantity: 100,
        currentPrice: 45.50,
        marketValue: 4550,
        holdingType: 'stock'
      }
    ]
  }
];

const processedData = bankScraperService.processInvestmentData(mockInvestmentData);
console.log('✓ Processed Investment Data:', JSON.stringify(processedData, null, 2));

// Test 4: Check if Investment model is accessible
try {
  const { Investment } = require('./src/models');
  console.log('\n✓ Investment Model loaded successfully');
  console.log('✓ Investment Model methods:', Object.getOwnPropertyNames(Investment.prototype).filter(name => name !== 'constructor'));
} catch (error) {
  console.error('✗ Investment Model error:', error.message);
}

console.log('\n🎉 Integration test completed!');
console.log('\nTo test with real data:');
console.log('1. Make sure your local israeli-bank-scrapers is in ../../israeli-bank-scrapers');
console.log('2. Ensure your israeli-bank-scrapers returns investments in the scraping result');
console.log('3. Use dataSyncService.syncBankAccountData() to scrape both transactions and investments');
