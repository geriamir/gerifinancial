const BankClassificationService = require('../../../banking/services/bankClassificationService');

describe('BankClassificationService', () => {
  
  describe('getCheckingBanks', () => {
    test('should return correct checking bank IDs', () => {
      const checkingBanks = BankClassificationService.getCheckingBanks();
      expect(checkingBanks).toEqual(['hapoalim', 'leumi', 'discount', 'otsarHahayal']);
    });
    
    test('should return array of strings', () => {
      const checkingBanks = BankClassificationService.getCheckingBanks();
      expect(Array.isArray(checkingBanks)).toBe(true);
      checkingBanks.forEach(bank => {
        expect(typeof bank).toBe('string');
      });
    });
  });
  
  describe('getCreditCardProviders', () => {
    test('should return correct credit card provider IDs', () => {
      const creditProviders = BankClassificationService.getCreditCardProviders();
      expect(creditProviders).toEqual(['visaCal', 'max', 'isracard']);
    });
    
    test('should return array of strings', () => {
      const creditProviders = BankClassificationService.getCreditCardProviders();
      expect(Array.isArray(creditProviders)).toBe(true);
      creditProviders.forEach(provider => {
        expect(typeof provider).toBe('string');
      });
    });
  });
  
  describe('isCheckingBank', () => {
    test('should return true for checking bank IDs', () => {
      expect(BankClassificationService.isCheckingBank('hapoalim')).toBe(true);
      expect(BankClassificationService.isCheckingBank('leumi')).toBe(true);
      expect(BankClassificationService.isCheckingBank('discount')).toBe(true);
      expect(BankClassificationService.isCheckingBank('otsarHahayal')).toBe(true);
    });
    
    test('should return false for credit card provider IDs', () => {
      expect(BankClassificationService.isCheckingBank('visaCal')).toBe(false);
      expect(BankClassificationService.isCheckingBank('max')).toBe(false);
      expect(BankClassificationService.isCheckingBank('isracard')).toBe(false);
    });
    
    test('should return false for unknown bank IDs', () => {
      expect(BankClassificationService.isCheckingBank('unknown')).toBe(false);
      expect(BankClassificationService.isCheckingBank('')).toBe(false);
      expect(BankClassificationService.isCheckingBank(null)).toBe(false);
      expect(BankClassificationService.isCheckingBank(undefined)).toBe(false);
    });
  });
  
  describe('isCreditCardProvider', () => {
    test('should return true for credit card provider IDs', () => {
      expect(BankClassificationService.isCreditCardProvider('visaCal')).toBe(true);
      expect(BankClassificationService.isCreditCardProvider('max')).toBe(true);
      expect(BankClassificationService.isCreditCardProvider('isracard')).toBe(true);
    });
    
    test('should return false for checking bank IDs', () => {
      expect(BankClassificationService.isCreditCardProvider('hapoalim')).toBe(false);
      expect(BankClassificationService.isCreditCardProvider('leumi')).toBe(false);
      expect(BankClassificationService.isCreditCardProvider('discount')).toBe(false);
      expect(BankClassificationService.isCreditCardProvider('otsarHahayal')).toBe(false);
    });
    
    test('should return false for unknown bank IDs', () => {
      expect(BankClassificationService.isCreditCardProvider('unknown')).toBe(false);
      expect(BankClassificationService.isCreditCardProvider('')).toBe(false);
      expect(BankClassificationService.isCreditCardProvider(null)).toBe(false);
      expect(BankClassificationService.isCreditCardProvider(undefined)).toBe(false);
    });
  });
  
  describe('getAllSupportedBanks', () => {
    test('should return all supported banks (checking + credit)', () => {
      const allBanks = BankClassificationService.getAllSupportedBanks();
      const expectedBanks = ['hapoalim', 'leumi', 'discount', 'otsarHahayal', 'visaCal', 'max', 'isracard'];
      expect(allBanks).toEqual(expectedBanks);
    });
    
    test('should return unique bank IDs', () => {
      const allBanks = BankClassificationService.getAllSupportedBanks();
      const uniqueBanks = [...new Set(allBanks)];
      expect(allBanks.length).toBe(uniqueBanks.length);
    });
  });
  
  describe('isSupportedBank', () => {
    test('should return true for all supported banks', () => {
      const supportedBanks = ['hapoalim', 'leumi', 'discount', 'otsarHahayal', 'visaCal', 'max', 'isracard'];
      supportedBanks.forEach(bank => {
        expect(BankClassificationService.isSupportedBank(bank)).toBe(true);
      });
    });
    
    test('should return false for unsupported banks', () => {
      expect(BankClassificationService.isSupportedBank('unknown')).toBe(false);
      expect(BankClassificationService.isSupportedBank('chase')).toBe(false);
      expect(BankClassificationService.isSupportedBank('')).toBe(false);
    });
  });
  
  describe('getBankType', () => {
    test('should return "checking" for checking banks', () => {
      expect(BankClassificationService.getBankType('hapoalim')).toBe('checking');
      expect(BankClassificationService.getBankType('leumi')).toBe('checking');
      expect(BankClassificationService.getBankType('discount')).toBe('checking');
      expect(BankClassificationService.getBankType('otsarHahayal')).toBe('checking');
    });
    
    test('should return "credit" for credit card providers', () => {
      expect(BankClassificationService.getBankType('visaCal')).toBe('credit');
      expect(BankClassificationService.getBankType('max')).toBe('credit');
      expect(BankClassificationService.getBankType('isracard')).toBe('credit');
    });
    
    test('should return null for unsupported banks', () => {
      expect(BankClassificationService.getBankType('unknown')).toBe(null);
      expect(BankClassificationService.getBankType('')).toBe(null);
      expect(BankClassificationService.getBankType(null)).toBe(null);
      expect(BankClassificationService.getBankType(undefined)).toBe(null);
    });
  });
  
  describe('getBanksByType', () => {
    test('should return checking banks for type "checking"', () => {
      const checkingBanks = BankClassificationService.getBanksByType('checking');
      expect(checkingBanks).toEqual(['hapoalim', 'leumi', 'discount', 'otsarHahayal']);
    });
    
    test('should return credit card providers for type "credit"', () => {
      const creditProviders = BankClassificationService.getBanksByType('credit');
      expect(creditProviders).toEqual(['visaCal', 'max', 'isracard']);
    });
    
    test('should return empty array for unknown type', () => {
      expect(BankClassificationService.getBanksByType('unknown')).toEqual([]);
      expect(BankClassificationService.getBanksByType('')).toEqual([]);
      expect(BankClassificationService.getBanksByType(null)).toEqual([]);
    });
  });
  
  describe('getCheckingBankDetails', () => {
    test('should return checking banks with names', () => {
      const bankDetails = BankClassificationService.getCheckingBankDetails();
      const expected = [
        { id: 'hapoalim', name: 'Bank Hapoalim' },
        { id: 'leumi', name: 'Bank Leumi' },
        { id: 'discount', name: 'Discount Bank' },
        { id: 'otsarHahayal', name: 'Otsar HaHayal' }
      ];
      expect(bankDetails).toEqual(expected);
    });
    
    test('should return objects with id and name properties', () => {
      const bankDetails = BankClassificationService.getCheckingBankDetails();
      bankDetails.forEach(bank => {
        expect(bank).toHaveProperty('id');
        expect(bank).toHaveProperty('name');
        expect(typeof bank.id).toBe('string');
        expect(typeof bank.name).toBe('string');
      });
    });
  });
  
  describe('getCreditCardProviderDetails', () => {
    test('should return credit card providers with names', () => {
      const providerDetails = BankClassificationService.getCreditCardProviderDetails();
      const expected = [
        { id: 'visaCal', name: 'Visa Cal' },
        { id: 'max', name: 'Max' },
        { id: 'isracard', name: 'Isracard' }
      ];
      expect(providerDetails).toEqual(expected);
    });
    
    test('should return objects with id and name properties', () => {
      const providerDetails = BankClassificationService.getCreditCardProviderDetails();
      providerDetails.forEach(provider => {
        expect(provider).toHaveProperty('id');
        expect(provider).toHaveProperty('name');
        expect(typeof provider.id).toBe('string');
        expect(typeof provider.name).toBe('string');
      });
    });
  });
  
  describe('getBankDetailsByType', () => {
    test('should return checking bank details for type "checking"', () => {
      const details = BankClassificationService.getBankDetailsByType('checking');
      expect(details).toEqual(BankClassificationService.getCheckingBankDetails());
    });
    
    test('should return credit card provider details for type "credit"', () => {
      const details = BankClassificationService.getBankDetailsByType('credit');
      expect(details).toEqual(BankClassificationService.getCreditCardProviderDetails());
    });
    
    test('should return empty array for unknown type', () => {
      expect(BankClassificationService.getBankDetailsByType('unknown')).toEqual([]);
      expect(BankClassificationService.getBankDetailsByType('')).toEqual([]);
      expect(BankClassificationService.getBankDetailsByType(null)).toEqual([]);
    });
  });
  
  describe('integration tests', () => {
    test('checking banks and credit card providers should not overlap', () => {
      const checkingBanks = BankClassificationService.getCheckingBanks();
      const creditProviders = BankClassificationService.getCreditCardProviders();
      
      // No overlap between arrays
      const intersection = checkingBanks.filter(bank => creditProviders.includes(bank));
      expect(intersection.length).toBe(0);
    });
    
    test('all banks should be classified correctly', () => {
      const allBanks = BankClassificationService.getAllSupportedBanks();
      
      allBanks.forEach(bank => {
        const isChecking = BankClassificationService.isCheckingBank(bank);
        const isCredit = BankClassificationService.isCreditCardProvider(bank);
        
        // Each bank should be exactly one type
        expect(isChecking || isCredit).toBe(true);
        expect(isChecking && isCredit).toBe(false);
      });
    });
  });
});
