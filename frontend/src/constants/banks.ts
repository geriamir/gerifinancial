export interface SupportedBank {
  id: string;
  name: string;
}

// Checking Account Banks (Primary onboarding focus)
export const CHECKING_ACCOUNT_BANKS: SupportedBank[] = [
  { id: 'hapoalim', name: 'Bank Hapoalim' },
  { id: 'leumi', name: 'Bank Leumi' },
  { id: 'discount', name: 'Discount Bank' },
  { id: 'otsarHahayal', name: 'Otsar HaHayal' }
];

// Credit Card Providers (Secondary onboarding step)
export const CREDIT_CARD_PROVIDERS: SupportedBank[] = [
  { id: 'visaCal', name: 'Visa Cal' },
  { id: 'max', name: 'Max' },
  { id: 'isracard', name: 'Isracard' }
];

// API-based banks (token-based REST API, no browser scraping)
export const API_BANKS: SupportedBank[] = [
  { id: 'mercury', name: 'Mercury' },
  { id: 'ibkr', name: 'Interactive Brokers' }
];

// OTP-based banks (browser automation with OTP login)
export const OTP_BANKS: SupportedBank[] = [
  { id: 'phoenix', name: 'Phoenix Insurance (הפניקס)' },
  { id: 'clal', name: 'Clal Insurance (כלל ביטוח)' }
];

// All supported banks (for backward compatibility)
export const SUPPORTED_BANKS: SupportedBank[] = [
  ...CHECKING_ACCOUNT_BANKS,
  ...CREDIT_CARD_PROVIDERS,
  ...API_BANKS,
  ...OTP_BANKS
];

// Helper functions for bank classification
export const getBankType = (bankId: string): 'checking' | 'credit' | 'api' | 'otp' | null => {
  if (CHECKING_ACCOUNT_BANKS.some(bank => bank.id === bankId)) {
    return 'checking';
  }
  if (CREDIT_CARD_PROVIDERS.some(bank => bank.id === bankId)) {
    return 'credit';
  }
  if (API_BANKS.some(bank => bank.id === bankId)) {
    return 'api';
  }
  if (OTP_BANKS.some(bank => bank.id === bankId)) {
    return 'otp';
  }
  return null;
};

export const isCheckingBank = (bankId: string): boolean => {
  return CHECKING_ACCOUNT_BANKS.some(bank => bank.id === bankId);
};

export const isCreditCardProvider = (bankId: string): boolean => {
  return CREDIT_CARD_PROVIDERS.some(bank => bank.id === bankId);
};

export const isApiBank = (bankId: string): boolean => {
  return API_BANKS.some(bank => bank.id === bankId);
};

export const isOtpBank = (bankId: string): boolean => {
  return OTP_BANKS.some(bank => bank.id === bankId);
};

export const getBankStrategies = (bankId?: string): string[] => {
  switch (bankId) {
    case 'mercury': return ['mercury-checking'];
    case 'ibkr': return ['ibkr-flex'];
    case 'phoenix': return ['phoenix-pension'];
    case 'clal': return ['clal-pension'];
    default: return ['checking-accounts', 'investment-portfolios', 'foreign-currency'];
  }
};

export const getBanksByType = (type: 'checking' | 'credit' | 'api' | 'otp'): SupportedBank[] => {
  if (type === 'checking') return CHECKING_ACCOUNT_BANKS;
  if (type === 'credit') return CREDIT_CARD_PROVIDERS;
  if (type === 'otp') return OTP_BANKS;
  return API_BANKS;
};
