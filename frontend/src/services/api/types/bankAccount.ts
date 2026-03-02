export interface BankAccount {
  _id: string;
  bankId: string;
  name: string;
  status: 'active' | 'error' | 'pending' | 'disabled';
  lastScraped: string | null;
  lastError?: {
    message: string;
    date: string;
  };
  credentials?: {
    username: string;
    // password is never exposed
  };
  scrapingConfig: {
    schedule: {
      frequency: 'daily' | 'weekly' | 'monthly';
      dayOfWeek?: number;
      dayOfMonth?: number;
      timeOfDay: string;
    };
    options: {
      startDate: string;
      monthsBack: number;
    };
  };
}

export interface AddBankAccountDto {
  bankId: string;
  name: string;
  credentials: {
    username: string;
    password: string;
  };
}

export interface ScrapeOptionsDto {
  showBrowser?: boolean;
  startDate?: string;
}

export interface SingleAccountScrapeResult {
  message: string;
  accountId: string;
  accountName: string;
  queuedJobs: string[];
  totalJobs: number;
  priority: string;
}

export interface BulkScrapeResult {
  totalAccounts: number;
  successfulScrapes: number;
  failedScrapes: number;
  errors: Array<{
    accountId: string;
    accountName: string;
    error: string;
  }>;
  totalNewTransactions: number;
  totalNeedingVerification: number;
}

export interface UpdateScrapingConfigDto {
  schedule?: {
    frequency?: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number;
    dayOfMonth?: number;
    timeOfDay?: string;
  };
  options?: {
    startDate?: string;
    monthsBack?: number;
  };
}
