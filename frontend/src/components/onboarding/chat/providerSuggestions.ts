import { CREDIT_CARD_PROVIDERS } from '../../../constants/banks';
import { OnboardingStatus } from '../../../services/api/onboarding';

// Keep these legacy-record fallback patterns aligned with
// backend/src/banking/services/creditCardPaymentMatcher.js. New analyses carry
// server-generated suggestions; this path exists for onboarding records saved
// before that field was introduced.
const PROVIDER_HINTS = [
  { bankId: 'isracard', pattern: /ישראכרט|\bisracard\b/i },
  { bankId: 'amex', pattern: /אמריקן\s*אקספרס|אמקס|american\s+express|\bamex\b/i },
  { bankId: 'visaCal', pattern: /דיינרס|ויזה\s*כאל|^\s*כאל(?:\s*-\s*י)?\s*$|\bdiners(?:\s+club)?\b|\bvisa\s*cal\b|\bcal\s+monthly\s+payment\b/i },
  { bankId: 'max', pattern: /מקס\s*(?:איט\s*)?פיננסים|^\s*מקס(?:\s*-\s*י)?\s*$|\bmax\s+monthly\s+payment\b/i }
];
const PROVIDER_ORDER = new Map(
  PROVIDER_HINTS.map((provider, index) => [provider.bankId, index])
);

export interface ProviderSuggestion {
  bankId: string;
  name: string;
  paymentCount: number;
}

const providerName = (bankId: string): string | null =>
  CREDIT_CARD_PROVIDERS.find((provider) => provider.id === bankId)?.name || null;

export const providerSuggestionsFor = (
  detection?: OnboardingStatus['creditCardDetection'] | null
): ProviderSuggestion[] => {
  const storedSuggestions = detection?.suggestedProviders || [];
  if (storedSuggestions.length > 0) {
    return storedSuggestions
      .map((suggestion) => {
        const name = providerName(suggestion.bankId);
        return name ? { ...suggestion, name } : null;
      })
      .filter((suggestion): suggestion is ProviderSuggestion => suggestion !== null)
      .sort((left, right) =>
        right.paymentCount - left.paymentCount ||
        (PROVIDER_ORDER.get(left.bankId) || 0) - (PROVIDER_ORDER.get(right.bankId) || 0)
      );
  }

  const counts = new Map<string, number>();
  for (const transaction of detection?.sampleTransactions || []) {
    const hint = PROVIDER_HINTS.find(({ pattern }) => pattern.test(transaction.description));
    if (hint) counts.set(hint.bankId, (counts.get(hint.bankId) || 0) + 1);
  }

  return PROVIDER_HINTS
    .map(({ bankId }) => ({
      bankId,
      name: providerName(bankId),
      paymentCount: counts.get(bankId) || 0
    }))
    .filter(
      (suggestion): suggestion is ProviderSuggestion =>
        suggestion.name !== null && suggestion.paymentCount > 0
    )
    .sort((left, right) =>
      right.paymentCount - left.paymentCount ||
      (PROVIDER_ORDER.get(left.bankId) || 0) - (PROVIDER_ORDER.get(right.bankId) || 0)
    );
};

export const providerNames = (suggestions: ProviderSuggestion[]): string => {
  const names = suggestions.map((suggestion) => suggestion.name);
  if (names.length <= 1) return names[0] || '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};
