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

// All supported banks (for backward compatibility)
export const SUPPORTED_BANKS: SupportedBank[] = [
  ...CHECKING_ACCOUNT_BANKS,
  ...CREDIT_CARD_PROVIDERS
];

// Helper functions for bank classification
export const getBankType = (bankId: string): 'checking' | 'credit' | null => {
  if (CHECKING_ACCOUNT_BANKS.some(bank => bank.id === bankId)) {
    return 'checking';
  }
  if (CREDIT_CARD_PROVIDERS.some(bank => bank.id === bankId)) {
    return 'credit';
  }
  return null;
};

export const isCheckingBank = (bankId: string): boolean => {
  return CHECKING_ACCOUNT_BANKS.some(bank => bank.id === bankId);
};

export const isCreditCardProvider = (bankId: string): boolean => {
  return CREDIT_CARD_PROVIDERS.some(bank => bank.id === bankId);
};

export const getBanksByType = (type: 'checking' | 'credit'): SupportedBank[] => {
  return type === 'checking' ? CHECKING_ACCOUNT_BANKS : CREDIT_CARD_PROVIDERS;
};
