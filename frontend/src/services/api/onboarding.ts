import api from './base';

export interface OnboardingStatus {
  isComplete: boolean;
  hasCheckingAccount: boolean;
  completedSteps: string[];
  hasCreditCards?: boolean;
  creditCardAnalysisResults?: {
    transactionCount: number;
    recommendation: string;
    analyzedAt: string;
  };
}

export interface UpdateOnboardingStatusDto {
  isComplete: boolean;
  completedSteps: string[];
  hasCheckingAccount: boolean;
  hasCreditCards?: boolean;
  creditCardAnalysisResults?: {
    transactionCount: number;
    recommendation: string;
    analyzedAt: Date;
  };
}

export interface CreditCardAnalysis {
  hasCreditCardActivity: boolean;
  transactionCount: number;
  recommendation: 'connect' | 'optional' | 'skip';
  recommendationReason: string;
  recentTransactions: Array<{
    date: string;
    description: string;
    amount: number;
  }>;
  analyzedAt: string;
}

export interface CreditCardCreationResult {
  creditCards: Array<{
    id: string;
    displayName: string;
    cardType: string | null;
    lastFourDigits: string | null;
  }>;
  matchingResults: {
    totalCreditCards: number;
    matchedCards: number;
    matchingAccuracy: number;
  };
}

export interface TransactionImportStatus {
  status: 'connecting' | 'scraping' | 'categorizing' | 'complete' | 'error' | 'not_started' | 'not_found';
  stage?: string;
  progress: number;
  message: string;
  transactionsImported: number;
  transactionsCategorized: number;
  error?: string;
  startedAt?: string;
  sessionId?: string;
  isActive: boolean;
  hasImportedTransactions: boolean;
}

export interface CoverageAnalysis {
  totalCreditCardPayments: number;
  coveredPayments: number;
  uncoveredPayments: number;
  coveragePercentage: number;
  uncoveredSampleTransactions: Array<{
    date: string;
    description: string;
    amount: number;
  }>;
  connectedCreditCards: Array<{
    id: string;
    displayName: string;
    provider: string;
    cardNumber?: string;
    lastFourDigits?: string;
  }>;
  matchedPayments: Array<{
    payment: {
      id: string;
      date: string;
      description: string;
      amount: number;
      originalAmount: number;
    };
    matchedCreditCard: {
      id: string;
      displayName: string;
      cardNumber?: string;
      lastFourDigits?: string;
      provider: string;
    };
    matchedMonth: string;
    matchedAmount: number;
    paymentAmount: number;
    amountDifference: number;
    matchType: string;
    matchConfidence: number;
  }>;
  recommendation: 'complete' | 'connect_more' | 'processing' | 'connect_cards';
  recommendationReason: string;
}

export const onboardingApi = {
  // Get current onboarding status
  getStatus: async (): Promise<OnboardingStatus> => {
    const response = await api.get('/users/onboarding-status');
    return response.data;
  },

  // Update onboarding status
  updateStatus: async (data: UpdateOnboardingStatusDto): Promise<OnboardingStatus> => {
    const response = await api.post('/users/onboarding-status', data);
    return response.data;
  },

  // Analyze credit card usage
  analyzeCreditCards: async (monthsBack: number = 6): Promise<CreditCardAnalysis> => {
    const response = await api.post('/onboarding/analyze-credit-cards', { monthsBack });
    return response.data.data;
  },

  // Create credit cards from scraped accounts
  createCreditCards: async (
    bankAccountId: string,
    scrapedAccounts: any[]
  ): Promise<CreditCardCreationResult> => {
    const response = await api.post('/onboarding/create-credit-cards', {
      bankAccountId,
      scrapedAccounts
    });
    return response.data.data;
  },

  // Get current scraping status for the user
  getScrapingStatus: async (): Promise<TransactionImportStatus> => {
    const response = await api.get('/onboarding/scraping-status');
    return response.data.data;
  },

  // Get real-time import status by session ID (for backwards compatibility)
  getImportStatus: async (sessionId: string): Promise<TransactionImportStatus> => {
    const response = await api.get(`/onboarding/import-status/${sessionId}`);
    return response.data.data;
  },

  // Analyze credit card transaction coverage after connecting accounts
  analyzeCoverage: async (): Promise<CoverageAnalysis> => {
    const response = await api.post('/onboarding/analyze-coverage');
    return response.data.data;
  }
};
