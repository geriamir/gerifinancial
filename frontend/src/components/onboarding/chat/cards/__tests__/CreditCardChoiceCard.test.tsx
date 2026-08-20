import React from 'react';
import { render, screen } from '@testing-library/react';
import { CreditCardChoiceCard } from '../CreditCardChoiceCard';
import { OnboardingStatus } from '../../../../../services/api/onboarding';
import { ChatHandlers } from '../../types';

const handlers: ChatHandlers = {
  connectCheckingAccount: jest.fn().mockResolvedValue(undefined),
  connectCreditCardAccount: jest.fn().mockResolvedValue(undefined),
  repairCreditCardAccount: jest.fn().mockResolvedValue(undefined),
  removeCreditCardAccount: jest.fn().mockResolvedValue(undefined),
  renameCreditCardAccount: jest.fn().mockResolvedValue(undefined),
  proceedToCreditCardSetup: jest.fn().mockResolvedValue(undefined),
  skipCreditCards: jest.fn().mockResolvedValue(undefined),
  completeOnboarding: jest.fn().mockResolvedValue(undefined)
};

const status = {
  creditCardDetection: {
    analyzed: true,
    analyzedAt: '2026-08-10T20:00:00Z',
    transactionCount: 5,
    recommendation: 'connect',
    sampleTransactions: [
      { date: '2026-08-01', description: 'ישראכרט בע"מ-י', amount: 557 },
      { date: '2026-07-01', description: 'כרטיסי אשראי-י', amount: 10009.46 },
      { date: '2026-06-01', description: 'כרטיסי אשראי-י 2', amount: 37964.51 },
      { date: '2026-05-01', description: 'כרטיסי אשראי-י 3', amount: 2000 },
      { date: '2026-04-01', description: 'כרטיסי אשראי-י 4', amount: 3000 }
    ]
  }
} as OnboardingStatus;

describe('CreditCardChoiceCard', () => {
  it('shows every payment sample returned by detection', () => {
    render(<CreditCardChoiceCard status={status} handlers={handlers} />);

    for (const transaction of status.creditCardDetection.sampleTransactions) {
      expect(screen.getByText(transaction.description)).toBeInTheDocument();
    }
  });

  it('suggests a provider from existing sample descriptions', () => {
    render(<CreditCardChoiceCard status={status} handlers={handlers} />);

    expect(screen.getByText('Suggested provider')).toBeInTheDocument();
    expect(screen.getByText('Isracard')).toBeInTheDocument();
  });

  it('explains when detection found more payments than the saved sample', () => {
    render(
      <CreditCardChoiceCard
        status={{
          ...status,
          creditCardDetection: {
            ...status.creditCardDetection,
            transactionCount: 7
          }
        }}
        handlers={handlers}
      />
    );

    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });
});
