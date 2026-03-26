export interface TaxBracket {
  upTo: number; // upper limit in local currency (Infinity for last bracket)
  rate: number; // percentage (e.g., 8 means 8%)
}

export interface TaxPreset {
  id: string;
  country: string;
  name: string;
  currency: string;
  brackets: TaxBracket[];
  notes?: string;
  discountPercent?: number; // e.g., Cyprus resale 50% discount
}

export const TAX_PRESETS: TaxPreset[] = [
  {
    id: 'il-investment',
    country: 'Israel',
    name: 'Israel – Investment Property',
    currency: 'ILS',
    brackets: [
      { upTo: 6055070, rate: 8 },
      { upTo: Infinity, rate: 10 }
    ],
    notes: 'Mas Rechisha for investment/additional property (valid through 2026)'
  },
  {
    id: 'il-first-home',
    country: 'Israel',
    name: 'Israel – First/Only Home',
    currency: 'ILS',
    brackets: [
      { upTo: 1978745, rate: 0 },
      { upTo: 2347040, rate: 3.5 },
      { upTo: 6055070, rate: 5 },
      { upTo: 20183565, rate: 8 },
      { upTo: Infinity, rate: 10 }
    ],
    notes: 'Mas Rechisha for sole residential property (brackets frozen through 2027)'
  },
  {
    id: 'cy-resale',
    country: 'Cyprus',
    name: 'Cyprus – Resale (No VAT)',
    currency: 'EUR',
    brackets: [
      { upTo: 85000, rate: 3 },
      { upTo: 170000, rate: 5 },
      { upTo: Infinity, rate: 8 }
    ],
    discountPercent: 50,
    notes: 'Transfer fees for resale properties; 50% discount typically applies'
  },
  {
    id: 'cy-resale-full',
    country: 'Cyprus',
    name: 'Cyprus – Resale (Full Rate)',
    currency: 'EUR',
    brackets: [
      { upTo: 85000, rate: 3 },
      { upTo: 170000, rate: 5 },
      { upTo: Infinity, rate: 8 }
    ],
    notes: 'Transfer fees without 50% discount'
  },
  {
    id: 'custom',
    country: 'Other',
    name: 'Custom (Flat Rate)',
    currency: '',
    brackets: [],
    notes: 'Enter a flat tax rate manually'
  }
];

/**
 * Calculate progressive tax from brackets.
 * Returns the total tax amount.
 */
export function calculateProgressiveTax(
  propertyValue: number,
  brackets: TaxBracket[],
  discountPercent?: number
): number {
  if (propertyValue <= 0 || brackets.length === 0) return 0;

  let totalTax = 0;
  let previousLimit = 0;

  for (const bracket of brackets) {
    if (propertyValue <= previousLimit) break;
    const taxableInBracket = Math.min(propertyValue, bracket.upTo) - previousLimit;
    if (taxableInBracket > 0) {
      totalTax += taxableInBracket * (bracket.rate / 100);
    }
    previousLimit = bracket.upTo;
  }

  if (discountPercent) {
    totalTax *= (1 - discountPercent / 100);
  }

  return Math.round(totalTax * 100) / 100;
}

/**
 * Calculate the effective flat tax rate from progressive brackets.
 * Returns the effective percentage (e.g., 7.5 means 7.5%).
 */
export function calculateEffectiveRate(
  propertyValue: number,
  brackets: TaxBracket[],
  discountPercent?: number
): number {
  if (propertyValue <= 0 || brackets.length === 0) return 0;
  const totalTax = calculateProgressiveTax(propertyValue, brackets, discountPercent);
  return Math.round((totalTax / propertyValue) * 10000) / 100;
}

/**
 * Get a tax preset by ID.
 */
export function getTaxPreset(id: string): TaxPreset | undefined {
  return TAX_PRESETS.find(p => p.id === id);
}
