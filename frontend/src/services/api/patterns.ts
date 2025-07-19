import { AxiosResponse } from 'axios';
import api from './base';

export interface DetectedPattern {
  id: string;
  patternId: string;
  description: string;
  amount: number;
  category: string;
  subcategory: string;
  patternType: 'bi-monthly' | 'quarterly' | 'yearly';
  confidence: number;
  scheduledMonths: number[];
  sampleTransactions: Array<{
    transactionId: string;
    description: string;
    amount: number;
    date: string;
  }>;
  detectedAt: string;
  displayName: string;
}

export interface PatternApproval {
  patternId: string;
  reason?: string;
}

export interface PatternPreview {
  month: number;
  year: number;
  monthName: string;
  patterns: Array<{
    id: string;
    description: string;
    category: string;
    subcategory: string;
    patternType: 'bi-monthly' | 'quarterly' | 'yearly';
    amount: number;
    scheduledMonths: number[];
    displayName: string;
  }>;
  totalPatternAmount: number;
  patternCount: number;
  hasPatterns: boolean;
}

export interface PendingPatternsResponse {
  success: boolean;
  data: {
    patterns: DetectedPattern[];
    totalCount: number;
  };
}

export interface PatternActionResponse {
  success: boolean;
  message: string;
  data?: any;
}

export interface BulkApprovalData {
  patternIds: string[];
}

export interface BulkApprovalResponse {
  success: boolean;
  data: {
    approvedPatterns: Array<{
      id: string;
      patternId: string;
      description: string;
      patternType: string;
    }>;
    totalApproved: number;
  };
  message: string;
}

export const patternsApi = {
  // Get pending patterns for user
  getPendingPatterns: (userId: string): Promise<PendingPatternsResponse> =>
    api.get<PendingPatternsResponse>(`/budgets/patterns/detected/${userId}`)
      .then((res: AxiosResponse<PendingPatternsResponse>) => res.data),

  // Approve a pattern
  approvePattern: (patternId: string): Promise<PatternActionResponse> =>
    api.post<PatternActionResponse>('/budgets/patterns/approve', { patternId })
      .then((res: AxiosResponse<PatternActionResponse>) => res.data),

  // Reject a pattern
  rejectPattern: (patternId: string, reason?: string): Promise<PatternActionResponse> =>
    api.post<PatternActionResponse>('/budgets/patterns/reject', { patternId, reason })
      .then((res: AxiosResponse<PatternActionResponse>) => res.data),

  // Bulk approve patterns
  bulkApprovePatterns: (patternIds: string[]): Promise<BulkApprovalResponse> =>
    api.put<BulkApprovalResponse>('/budgets/patterns/bulk-approve', { patternIds })
      .then((res: AxiosResponse<BulkApprovalResponse>) => res.data),

  // Get pattern preview for specific month
  getPatternPreview: (year: number, month: number): Promise<PatternPreview> =>
    api.get<PatternPreview>(`/budgets/patterns/preview/${year}/${month}`)
      .then((res: AxiosResponse<PatternPreview>) => res.data),
};
