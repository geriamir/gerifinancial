import api from './base';

// New comprehensive onboarding status structure
export interface OnboardingStatus {
  isComplete: boolean;
  currentStep: 'checking-account' | 'transaction-import' | 'credit-card-detection' | 'credit-card-setup' | 'credit-card-matching' | 'complete';
  startedAt: string | null;
  completedAt: string | null;
  
  checkingAccount: {
    connected: boolean;
    accountId: {
      _id: string;
      bankId: string;
      displayName: string;
    } | null;
    connectedAt: string | null;
    bankId: string | null;
  };
  
  transactionImport: {
    completed: boolean;
    transactionsImported: number;
    completedAt: string | null;
    scrapingStatus: {
      isActive: boolean;
      status: string | null;
      progress: number;
      message: string | null;
      error: string | null;
    };
  };
  
  creditCardDetection: {
    analyzed: boolean;
    analyzedAt: string | null;
    transactionCount: number;
    recommendation: 'connect' | 'optional' | 'skip' | null;
    sampleTransactions: Array<{
      date: string;
      description: string;
      amount: number;
    }>;
  };
  
  creditCardSetup: {
    skipped: boolean;
    skippedAt: string | null;
    creditCardAccounts: Array<{
      accountId: {
        _id: string;
        bankId: string;
        displayName: string;
      };
      connectedAt: string;
      bankId: string;
      displayName: string;
    }>;
  };
  
  creditCardMatching: {
    completed: boolean;
    completedAt: string | null;
    totalCreditCardPayments: number;
    coveredPayments: number;
    uncoveredPayments: number;
    coveragePercentage: number;
    matchedPayments: Array<{
      payment: {
        id: string;
        date: string;
        description: string;
        amount: number;
      };
      matchedCreditCard: {
        id: string;
        displayName: string;
        cardNumber: string;
        lastFourDigits: string;
        provider: string;
      };
      matchedMonth: string;
      matchConfidence: number;
    }>;
    uncoveredSampleTransactions?: Array<{
      date: string;
      description: string;
      amount: number;
    }>;
    connectedCreditCards?: Array<{
      id: string;
      displayName: string;
      provider: string;
    }>;
  };
  
  completedSteps: string[];
}

// Legacy status for backward compatibility
export interface LegacyOnboardingStatus {
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
  // ========== NEW ONBOARDING API ==========
  
  /**
   * Get complete onboarding status with new structure
   * Use this for determining current step and what to display
   */
  getOnboardingStatus: async (): Promise<OnboardingStatus> => {
    const response = await api.get('/onboarding/status');
    return response.data.data;
  },

  /**
   * Add checking account during onboarding
   * Different from regular account addition - tracks account in onboarding
   */
  addCheckingAccount: async (bankId: string, credentials: any, displayName?: string) => {
    const response = await api.post('/onboarding/checking-account', {
      bankId,
      credentials,
      displayName
    });
    return response.data.data;
  },

  /**
   * Add credit card account during onboarding
   * Different from regular credit card addition - tracks in onboarding
   */
  addCreditCardAccount: async (bankId: string, credentials: any, displayName?: string) => {
    const response = await api.post('/onboarding/credit-card-account', {
      bankId,
      credentials,
      displayName
    });
    return response.data.data;
  },

  /**
   * Proceed to credit card setup after viewing detection
   */
  proceedToCreditCardSetup: async () => {
    const response = await api.post('/onboarding/proceed-to-credit-card-setup');
    return response.data.data;
  },

  /**
   * Skip credit card setup during onboarding
   * Completes onboarding without credit cards
   */
  skipCreditCards: async () => {
    const response = await api.post('/onboarding/skip-credit-cards');
    return response.data.data;
  },

  /**
   * Complete onboarding (with or without full credit card coverage)
   * Can be used when user wants to complete even with partial coverage
   */
  completeOnboarding: async () => {
    const response = await api.post('/onboarding/complete-onboarding');
    return response.data.data;
  },

  // ========== LEGACY API (for backward compatibility) ==========
  
  // Get current onboarding status (legacy)
  getStatus: async (): Promise<OnboardingStatus> => {
    const response = await api.get('/users/onboarding-status');
    return response.data;
  },

  // Update onboarding status (legacy)
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
  analyzeCoverage: async (bankAccountId?: string): Promise<CoverageAnalysis> => {
    const response = await api.post('/onboarding/analyze-coverage', { bankAccountId });
    return response.data.data;
  }
};
