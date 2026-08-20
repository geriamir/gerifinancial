import { providerSuggestionsFor } from '../providerSuggestions';
import { OnboardingStatus } from '../../../../services/api/onboarding';

describe('providerSuggestionsFor', () => {
  it('recognizes supported providers from English settlement descriptions', () => {
    const detection = {
      analyzed: true,
      analyzedAt: '2026-08-10T20:00:00Z',
      transactionCount: 6,
      recommendation: 'connect',
      sampleTransactions: [
        { date: '2026-08-01', description: 'Isracard monthly payment', amount: 1000 },
        { date: '2026-08-01', description: 'American Express monthly payment', amount: 1500 },
        { date: '2026-08-01', description: 'Amex monthly payment', amount: 1500 },
        { date: '2026-08-01', description: 'Diners Club monthly payment', amount: 2000 },
        { date: '2026-08-01', description: 'CAL monthly payment', amount: 3000 },
        { date: '2026-08-01', description: 'MAX monthly payment', amount: 4000 }
      ]
    } satisfies OnboardingStatus['creditCardDetection'];

    expect(providerSuggestionsFor(detection)).toEqual([
      { bankId: 'amex', name: 'American Express', paymentCount: 2 },
      { bankId: 'visaCal', name: 'Visa Cal', paymentCount: 2 },
      { bankId: 'isracard', name: 'Isracard', paymentCount: 1 },
      { bankId: 'max', name: 'Max', paymentCount: 1 }
    ]);
  });

  it('uses the backend provider order to break stored-suggestion ties', () => {
    const detection = {
      analyzed: true,
      analyzedAt: '2026-08-10T20:00:00Z',
      transactionCount: 8,
      recommendation: 'connect',
      suggestedProviders: [
        { bankId: 'max', paymentCount: 2 },
        { bankId: 'isracard', paymentCount: 2 },
        { bankId: 'amex', paymentCount: 2 },
        { bankId: 'visaCal', paymentCount: 2 }
      ],
      sampleTransactions: []
    } satisfies OnboardingStatus['creditCardDetection'];

    expect(providerSuggestionsFor(detection).map(({ bankId }) => bankId)).toEqual([
      'isracard',
      'amex',
      'visaCal',
      'max'
    ]);
  });
});
