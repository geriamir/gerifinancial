export interface SupportedBank {
  id: string;
  name: string;
}

export const SUPPORTED_BANKS: SupportedBank[] = [
  { id: 'hapoalim', name: 'Bank Hapoalim' },
  { id: 'leumi', name: 'Bank Leumi' },
  { id: 'discount', name: 'Discount Bank' },
  { id: 'otsarHahayal', name: 'Otsar HaHayal' },
  { id: 'visaCal', name: 'Visa Cal' },
  { id: 'max', name: 'Max' },
  { id: 'isracard', name: 'Isracard' }
];
