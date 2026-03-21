export interface PensionInvestmentRoute {
  name: string;
  allocationPercent: number;
  yieldPercent: number | null;
  amount: number;
  currency: string;
  updateDate: string | null;
  isActive: boolean;
}

export interface PensionManagementFee {
  fromDeposit: number | null;
  fromSaving: number | null;
  validUntil: string | null;
}

export interface PensionYearlyTransactionItem {
  title: string;
  subTitle: string | null;
  amount: number | null;
  currency: string;
}

export interface PensionYearlyTransaction {
  year: number;
  updateDate: string | null;
  items: PensionYearlyTransactionItem[];
}

export interface PensionExpectedPayment {
  title: string;
  subTitle: string | null;
  amount: number | null;
  currency: string;
}

export type PensionProductType = 'gemel' | 'hishtalmut' | 'pension' | 'lifeSaving' | 'pizuim' | 'health' | 'life' | 'other';

export interface PensionAccount {
  _id: string;
  userId: string;
  bankAccountId: string | { _id: string; name: string; bankId: string };
  provider: string;
  productType: PensionProductType;
  policyId: string;
  policyName: string;
  policyNickname: string | null;
  accountNumber: string | null;
  balance: number;
  currency: string;
  status: string;
  employerName: string | null;
  startDate: string | null;
  investmentRoutes: PensionInvestmentRoute[];
  managementFee: PensionManagementFee;
  yearlyTransactions: PensionYearlyTransaction[];
  expectedPayments: PensionExpectedPayment[];
  lastSynced: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PensionSnapshot {
  _id: string;
  pensionAccountId: string;
  date: string;
  totalBalance: number;
  currency: string;
  routeBreakdown: {
    name: string;
    allocationPercent: number;
    amount: number;
    yieldPercent: number | null;
  }[];
}

export interface PensionSummaryGroup {
  productType: PensionProductType;
  totalBalance: number;
  accountCount: number;
  accounts: {
    _id: string;
    policyName: string;
    balance: number;
    provider: string;
    employerName: string | null;
  }[];
}

export interface PensionSummary {
  totalBalance: number;
  currency: string;
  groups: PensionSummaryGroup[];
}

export interface PensionSyncResult {
  message: string;
  synced: number;
  detailsFetched: number;
  errors: string[];
}

export const PRODUCT_TYPE_LABELS: Record<PensionProductType, string> = {
  gemel: 'קופת גמל',
  hishtalmut: 'קרן השתלמות',
  pension: 'פנסיה',
  lifeSaving: 'ביטוח מנהלים',
  pizuim: 'פיצויים',
  health: 'ביטוח בריאות',
  life: 'ביטוח חיים',
  other: 'אחר'
};

export const PRODUCT_TYPE_COLORS: Record<PensionProductType, string> = {
  gemel: '#2196F3',
  hishtalmut: '#4CAF50',
  pension: '#FF9800',
  lifeSaving: '#9C27B0',
  pizuim: '#F44336',
  health: '#00BCD4',
  life: '#795548',
  other: '#607D8B'
};
