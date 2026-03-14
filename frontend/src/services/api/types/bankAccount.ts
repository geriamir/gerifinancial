export interface BankAccount {
  _id: string;
  bankId: string;
  name: string;
  status: 'active' | 'error' | 'pending' | 'disabled';
  lastScraped: string | null;
  currentBalance?: number | null;
  lastBalanceUpdate?: string | null;
  defaultCurrency?: string;
  lastError?: {
    message: string;
    date: string;
  } | null;
  strategySync?: {
    [key: string]: {
      lastScraped: string | null;
      lastAttempted: string | null;
      status: 'success' | 'failed' | 'never';
    };
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
    username?: string;
    password?: string;
    apiToken?: string;
    flexToken?: string;
    queryId?: string;
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

export interface BalanceSnapshot {
  date: string;
  balance: number;
  availableBalance: number | null;
  currency: string;
  dayChange: number;
  dayChangePercent: number;
}

export interface BalanceSummaryItem {
  bankAccountId: string;
  date: string;
  balance: number;
  availableBalance: number | null;
  currency: string;
  dayChange: number;
  dayChangePercent: number;
  convertedBalance: number;
  convertedDayChange: number;
  displayCurrency: string;
  accountName: string;
  bankId: string;
  accountStatus: string;
}

export interface NetWorthHistoryItem {
  date: string;
  dateString: string;
  totalBalance: number;
  accountCount: number;
}
