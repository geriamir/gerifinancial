export interface SupportedBank {
  id: string;
  name: string;
  /**
   * Two or three letters shown when there is no logo file. Unique within a
   * group, so a list of them reads as distinct options rather than as a
   * rendering bug.
   */
  monogram: string;
  /** Background the monogram sits on. Chosen per group to stay distinguishable. */
  color: string;
  /**
   * Path to a logo under `public/`, if one has been added. Bank logos are
   * trademarks, so this is only set where the mark was taken from that bank's
   * own public site and is used nominatively - to name the bank you are
   * connecting to. Leave it unset and the monogram renders instead; `BankIcon`
   * also falls back on its own if the file is missing or fails to load, so a
   * dropped asset degrades to a readable badge rather than a blank space.
   */
  logo?: string;
}

// Checking Account Banks (Primary onboarding focus)
export const CHECKING_ACCOUNT_BANKS: SupportedBank[] = [
  { id: 'hapoalim', name: 'Bank Hapoalim', monogram: 'HP', color: '#C8102E', logo: '/banks/hapoalim.png' },
  { id: 'leumi', name: 'Bank Leumi', monogram: 'LM', color: '#1B3A6B', logo: '/banks/leumi.png' },
  { id: 'discount', name: 'Discount Bank', monogram: 'DS', color: '#00843D', logo: '/banks/discount.png' },
  { id: 'otsarHahayal', name: 'Otsar HaHayal', monogram: 'OH', color: '#0F7B8A', logo: '/banks/otsarHahayal.png' }
];

// Credit Card Providers (Secondary onboarding step)
export const CREDIT_CARD_PROVIDERS: SupportedBank[] = [
  { id: 'visaCal', name: 'Visa Cal', monogram: 'CAL', color: '#0057B8' },
  { id: 'max', name: 'Max', monogram: 'MAX', color: '#5B2C86' },
  { id: 'isracard', name: 'Isracard', monogram: 'ISR', color: '#E4761B' }
];

// API-based banks (token-based REST API, no browser scraping)
export const API_BANKS: SupportedBank[] = [
  { id: 'mercury', name: 'Mercury', monogram: 'MC', color: '#5A31F4' },
  { id: 'ibkr', name: 'Interactive Brokers', monogram: 'IB', color: '#B3202C' }
];

// OTP-based banks (browser automation with OTP login)
export const OTP_BANKS: SupportedBank[] = [
  { id: 'phoenix', name: 'Phoenix Insurance (הפניקס)', monogram: 'PX', color: '#F26522' },
  { id: 'clal', name: 'Clal Insurance (כלל ביטוח)', monogram: 'CL', color: '#004B8D' }
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

export const getBank = (bankId: string): SupportedBank | undefined =>
  SUPPORTED_BANKS.find(bank => bank.id === bankId);

export const getBankName = (bankId: string): string => getBank(bankId)?.name ?? bankId;
