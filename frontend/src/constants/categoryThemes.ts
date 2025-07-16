/**
 * Category Theming System
 * 
 * This module provides color themes for transaction categories to create
 * a cohesive visual experience across the application.
 * 
 * Each category type has a primary theme with variants for different contexts:
 * - primary: Main color for the category
 * - secondary: Lighter variant for backgrounds
 * - background: Very light variant for card backgrounds
 * - hover: Color for hover states
 * - selected: Color for selected states
 * - border: Border color variant
 * 
 * @module categoryThemes
 */

/**
 * Represents a complete color theme for a category
 */
export interface CategoryTheme {
  /** Main color for the category */
  primary: string;
  /** Lighter variant for secondary elements */
  secondary: string;
  /** Very light variant for backgrounds */
  background: string;
  /** Color for hover states */
  hover: string;
  /** Color for selected states */
  selected: string;
  /** Border color variant */
  border: string;
  /** Text color that works well with the theme */
  text: string;
  /** Contrast text color for use on primary background */
  contrastText: string;
}

/**
 * Transaction type themes - base colors for different transaction types
 */
export const transactionTypeThemes: Record<string, CategoryTheme> = {
  Income: {
    primary: '#22c55e',     // green-500
    secondary: '#16a34a',   // green-600
    background: '#f0fdf4',  // green-50
    hover: '#15803d',       // green-700
    selected: '#dcfce7',    // green-100
    border: '#bbf7d0',      // green-200
    text: '#166534',        // green-800
    contrastText: '#ffffff',
  },
  Expense: {
    primary: '#ef4444',     // red-500
    secondary: '#dc2626',   // red-600
    background: '#fef2f2',  // red-50
    hover: '#b91c1c',       // red-700
    selected: '#fecaca',    // red-100
    border: '#fca5a5',      // red-200
    text: '#991b1b',        // red-800
    contrastText: '#ffffff',
  },
  Transfer: {
    primary: '#3b82f6',     // blue-500
    secondary: '#2563eb',   // blue-600
    background: '#eff6ff',  // blue-50
    hover: '#1d4ed8',       // blue-700
    selected: '#dbeafe',    // blue-100
    border: '#93c5fd',      // blue-200
    text: '#1e40af',        // blue-800
    contrastText: '#ffffff',
  },
};

/**
 * Specific category themes - detailed colors for specific categories
 */
export const categoryThemes: Record<string, CategoryTheme> = {
  // Travel - #4DD0E1 (Light Blue)
  Travel: {
    primary: '#4DD0E1',
    secondary: '#26C6DA',
    background: '#E0F7FA',
    hover: '#00BCD4',
    selected: '#B2EBF2',
    border: '#80DEEA',
    text: '#006064',
    contrastText: '#ffffff',
  },
  
  // Salary - #4CAF50 (Green)
  'Salary': {
    primary: '#4CAF50',
    secondary: '#43A047',
    background: '#E8F5E8',
    hover: '#388E3C',
    selected: '#C8E6C9',
    border: '#81C784',
    text: '#2E7D32',
    contrastText: '#ffffff',
  },
  
  // Shopping - #FF8A65 (Light Orange)
  Shopping: {
    primary: '#FF8A65',
    secondary: '#FF7043',
    background: '#FBE9E7',
    hover: '#FF5722',
    selected: '#FFCCBC',
    border: '#FFAB91',
    text: '#BF360C',
    contrastText: '#ffffff',
  },
  
  // Credit Card - #2196F3 (Blue)
  'Credit Card': {
    primary: '#2196F3',
    secondary: '#1976D2',
    background: '#E3F2FD',
    hover: '#1565C0',
    selected: '#BBDEFB',
    border: '#64B5F6',
    text: '#0D47A1',
    contrastText: '#ffffff',
  },
  
  // Savings - #64B5F6 (Light Blue)
  Savings: {
    primary: '#64B5F6',
    secondary: '#42A5F5',
    background: '#E3F2FD',
    hover: '#2196F3',
    selected: '#BBDEFB',
    border: '#90CAF9',
    text: '#1565C0',
    contrastText: '#ffffff',
  },
  
  // Investments - #42A5F5 (Medium Blue)
  Investments: {
    primary: '#42A5F5',
    secondary: '#2196F3',
    background: '#E3F2FD',
    hover: '#1976D2',
    selected: '#BBDEFB',
    border: '#64B5F6',
    text: '#1565C0',
    contrastText: '#ffffff',
  },
  
  // Cash Withdrawal - #90CAF9 (Light Blue)
  'Cash Withdrawal': {
    primary: '#90CAF9',
    secondary: '#64B5F6',
    background: '#E3F2FD',
    hover: '#42A5F5',
    selected: '#BBDEFB',
    border: '#90CAF9',
    text: '#1976D2',
    contrastText: '#000000',
  },
  
  // Allowance - #AED581 (Light Green)
  Allowance: {
    primary: '#AED581',
    secondary: '#9CCC65',
    background: '#F1F8E9',
    hover: '#8BC34A',
    selected: '#DCEDC8',
    border: '#C5E1A5',
    text: '#689F38',
    contrastText: '#000000',
  },
  
  // Dividends & Profits - #43A047 (Green)
  'Dividends & Profits': {
    primary: '#43A047',
    secondary: '#388E3C',
    background: '#E8F5E8',
    hover: '#2E7D32',
    selected: '#C8E6C9',
    border: '#66BB6A',
    text: '#1B5E20',
    contrastText: '#ffffff',
  },
  
  // Refunds - #B2DFDB (Light Teal)
  Refunds: {
    primary: '#B2DFDB',
    secondary: '#80CBC4',
    background: '#E0F2F1',
    hover: '#4DB6AC',
    selected: '#B2DFDB',
    border: '#80CBC4',
    text: '#00695C',
    contrastText: '#000000',
  },
  
  // Income Misc. - #1B5E20 (Dark Green)
  'Income Misc.': {
    primary: '#1B5E20',
    secondary: '#2E7D32',
    background: '#E8F5E8',
    hover: '#388E3C',
    selected: '#C8E6C9',
    border: '#66BB6A',
    text: '#1B5E20',
    contrastText: '#ffffff',
  },
  
  // Household - #FF7043 (Orange)
  Household: {
    primary: '#FF7043',
    secondary: '#FF5722',
    background: '#FBE9E7',
    hover: '#E64A19',
    selected: '#FFCCBC',
    border: '#FF8A65',
    text: '#BF360C',
    contrastText: '#ffffff',
  },
  
  // Family - #FFB74D (Orange/Yellow)
  Family: {
    primary: '#FFB74D',
    secondary: '#FFA726',
    background: '#FFF8E1',
    hover: '#FF9800',
    selected: '#FFE0B2',
    border: '#FFCC02',
    text: '#E65100',
    contrastText: '#000000',
  },
  
  // Health - #E57373 (Light Red)
  Health: {
    primary: '#E57373',
    secondary: '#F44336',
    background: '#FFEBEE',
    hover: '#D32F2F',
    selected: '#FFCDD2',
    border: '#EF9A9A',
    text: '#C62828',
    contrastText: '#ffffff',
  },
  
  // Cars and Transportation - #BA68C8 (Purple)
  'Cars and Transportation': {
    primary: '#BA68C8',
    secondary: '#AB47BC',
    background: '#F3E5F5',
    hover: '#8E24AA',
    selected: '#E1BEE7',
    border: '#CE93D8',
    text: '#6A1B9A',
    contrastText: '#ffffff',
  },
  
  // Eating Out - #F06292 (Pink)
  'Eating Out': {
    primary: '#F06292',
    secondary: '#E91E63',
    background: '#FCE4EC',
    hover: '#C2185B',
    selected: '#F8BBD9',
    border: '#F48FB1',
    text: '#AD1457',
    contrastText: '#ffffff',
  },
  
  // Entertainment - #9575CD (Purple)
  Entertainment: {
    primary: '#9575CD',
    secondary: '#7E57C2',
    background: '#EDE7F6',
    hover: '#5E35B1',
    selected: '#D1C4E9',
    border: '#B39DDB',
    text: '#4527A0',
    contrastText: '#ffffff',
  },
  
  // Miscellaneous - #A1887F (Brown)
  Miscellaneous: {
    primary: '#A1887F',
    secondary: '#8D6E63',
    background: '#EFEBE9',
    hover: '#6D4C41',
    selected: '#D7CCC8',
    border: '#BCAAA4',
    text: '#5D4037',
    contrastText: '#ffffff',
  },
  
  // Financial Services - #8D6E63 (Brown)
  'Financial Services': {
    primary: '#8D6E63',
    secondary: '#795548',
    background: '#EFEBE9',
    hover: '#5D4037',
    selected: '#D7CCC8',
    border: '#A1887F',
    text: '#3E2723',
    contrastText: '#ffffff',
  },
  
  // Default fallback - using Miscellaneous colors
  'Default': {
    primary: '#A1887F',
    secondary: '#8D6E63',
    background: '#EFEBE9',
    hover: '#6D4C41',
    selected: '#D7CCC8',
    border: '#BCAAA4',
    text: '#5D4037',
    contrastText: '#ffffff',
  },
};

/**
 * Get the theme for a specific category
 * @param categoryName - The name of the category
 * @returns The theme object for the category, or default theme if not found
 */
export const getCategoryTheme = (categoryName: string): CategoryTheme => {
  return categoryThemes[categoryName] || categoryThemes.Miscellaneous;
};

/**
 * Get the theme for a transaction type
 * @param transactionType - The type of transaction (Income, Expense, Transfer)
 * @returns The theme object for the transaction type
 */
export const getTransactionTypeTheme = (transactionType: string): CategoryTheme => {
  return transactionTypeThemes[transactionType] || transactionTypeThemes.Expense;
};

/**
 * Generate a lighter version of a color (for backgrounds)
 * @param color - The base color
 * @param opacity - The opacity level (0-1)
 * @returns RGBA color string
 */
export const lightenColor = (color: string, opacity: number = 0.1): string => {
  // Convert hex to RGB
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

/**
 * Get contrasting text color for a given background color
 * @param backgroundColor - The background color
 * @returns Either black or white text color
 */
export const getContrastingTextColor = (backgroundColor: string): string => {
  // Simple contrast calculation - in a real app you might want a more sophisticated approach
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? '#000000' : '#ffffff';
};
