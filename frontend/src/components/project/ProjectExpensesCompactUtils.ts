import { formatCurrency } from '../../types/foreignCurrency';

export interface CompactViewMode {
  id: 'table' | 'list';
  name: string;
  description: string;
}

export const VIEW_MODES: CompactViewMode[] = [
  {
    id: 'table',
    name: 'Table',
    description: 'Compact table with sortable columns'
  },
  {
    id: 'list',
    name: 'List', 
    description: 'Dense list with inline progress'
  }
];

// Compact spacing constants
export const COMPACT_SPACING = {
  minimal: 0.25,
  small: 0.5,
  medium: 1,
  large: 1.5
} as const;

// Compact formatting utilities
export const formatCompactCurrency = (amount: number, currency: string, maxLength: number = 12): string => {
  const formatted = formatCurrency(amount, currency);
  return formatted.length > maxLength ? 
    `${formatted.substring(0, maxLength - 1)}…` : 
    formatted;
};

export const getCompactProgressColor = (actual: number, budgeted: number, isWarning: boolean = false) => {
  if (isWarning) return 'warning.main';
  const ratio = actual / budgeted;
  if (ratio > 1) return 'error.main';
  if (ratio > 0.8) return 'warning.main';
  return 'primary.main';
};

export const getCompactProgressWidth = (actual: number, budgeted: number): number => {
  if (budgeted === 0) return 0;
  return Math.min((actual / budgeted) * 100, 100);
};

// Recommendation confidence colors
export const getRecommendationChipColor = (confidence: number, wouldExceedBudget: boolean) => {
  if (wouldExceedBudget) return 'error' as const;
  if (confidence >= 95) return 'success' as const;
  if (confidence >= 70) return 'primary' as const;
  return 'warning' as const;
};

// Truncate text for compact display
export const truncateText = (text: string, maxLength: number): string => {
  return text.length > maxLength ? `${text.substring(0, maxLength - 1)}…` : text;
};

// Get compact date format
export const formatCompactDate = (date: string | Date): string => {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
};

// Calculate hierarchy depth for indentation
export const getHierarchyIndent = (level: number): number => {
  return level * 16; // 16px per level
};
