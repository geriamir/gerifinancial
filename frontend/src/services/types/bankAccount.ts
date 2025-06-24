export interface BankAccount {
  _id: string;
  userId: string;
  bankId: string;
  name: string;
  status: 'active' | 'error' | 'pending' | 'disabled';
  lastScraped: string | null;
  lastError?: {
    message: string;
    date: string;
  };
  scrapingConfig: {
    schedule: {
      frequency: 'daily' | 'weekly' | 'monthly';
      dayOfWeek?: number;
      dayOfMonth?: number;
      timeOfDay: string;
    };
  };
}

export interface ScrapeResult {
  totalAccounts: number;
  successfulScrapes: number;
  failedScrapes: number;
  errors: Array<{
    accountId: string;
    accountName: string;
    error: string;
  }>;
}

export interface SingleAccountScrapeResult {
  newTransactions: number;
  duplicates: number;
  errors: string[];
}
