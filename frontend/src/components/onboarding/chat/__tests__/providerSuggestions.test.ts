import { providerSuggestionsFor } from '../providerSuggestions';
import { OnboardingStatus } from '../../../../services/api/onboarding';

describe('providerSuggestionsFor', () => {
  it('recognizes supported providers from English settlement descriptions', () => {
    const detection = {
      sampleTransactions: [
        { date: '2026-08-01', description: 'Isracard monthly payment', amount: 1000 },
        { date: '2026-08-01', description: 'Diners Club monthly payment', amount: 2000 },
        { date: '2026-08-01', description: 'CAL monthly payment', amount: 3000 },
        { date: '2026-08-01', description: 'MAX monthly payment', amount: 4000 }
      ]
    } as OnboardingStatus['creditCardDetection'];

    expect(providerSuggestionsFor(detection)).toEqual([
      { bankId: 'visaCal', name: 'Visa Cal', paymentCount: 2 },
      { bankId: 'isracard', name: 'Isracard', paymentCount: 1 },
      { bankId: 'max', name: 'Max', paymentCount: 1 }
    ]);
  });
});
