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
  // Household categories
  Household: {
    primary: '#f97316',     // orange-500
    secondary: '#ea580c',   // orange-600
    background: '#fff7ed',  // orange-50
    hover: '#c2410c',       // orange-700
    selected: '#fed7aa',    // orange-100
    border: '#fdba74',      // orange-200
    text: '#9a3412',        // orange-800
    contrastText: '#ffffff',
  },
  
  // Health categories
  Health: {
    primary: '#8b5cf6',     // violet-500
    secondary: '#7c3aed',   // violet-600
    background: '#f5f3ff',  // violet-50
    hover: '#6d28d9',       // violet-700
    selected: '#e9d5ff',    // violet-100
    border: '#c4b5fd',      // violet-200
    text: '#5b21b6',        // violet-800
    contrastText: '#ffffff',
  },
  
  // Entertainment categories
  Entertainment: {
    primary: '#ec4899',     // pink-500
    secondary: '#db2777',   // pink-600
    background: '#fdf2f8',  // pink-50
    hover: '#be185d',       // pink-700
    selected: '#fce7f3',    // pink-100
    border: '#f9a8d4',      // pink-200
    text: '#9d174d',        // pink-800
    contrastText: '#ffffff',
  },
  
  // Financial services
  'Financial Services': {
    primary: '#6366f1',     // indigo-500
    secondary: '#4f46e5',   // indigo-600
    background: '#eef2ff',  // indigo-50
    hover: '#4338ca',       // indigo-700
    selected: '#e0e7ff',    // indigo-100
    border: '#a5b4fc',      // indigo-200
    text: '#3730a3',        // indigo-800
    contrastText: '#ffffff',
  },
  
  // Cars and transportation
  Cars: {
    primary: '#06b6d4',     // cyan-500
    secondary: '#0891b2',   // cyan-600
    background: '#ecfeff',  // cyan-50
    hover: '#0e7490',       // cyan-700
    selected: '#cffafe',    // cyan-100
    border: '#67e8f9',      // cyan-200
    text: '#155e75',        // cyan-800
    contrastText: '#ffffff',
  },
  
  // Shopping
  Shopping: {
    primary: '#84cc16',     // lime-500
    secondary: '#65a30d',   // lime-600
    background: '#f7fee7',  // lime-50
    hover: '#4d7c0f',       // lime-700
    selected: '#ecfccb',    // lime-100
    border: '#bef264',      // lime-200
    text: '#365314',        // lime-800
    contrastText: '#ffffff',
  },
  
  // Eating Out
  'Eating Out': {
    primary: '#f59e0b',     // amber-500
    secondary: '#d97706',   // amber-600
    background: '#fffbeb',  // amber-50
    hover: '#b45309',       // amber-700
    selected: '#fef3c7',    // amber-100
    border: '#fcd34d',      // amber-200
    text: '#92400e',        // amber-800
    contrastText: '#ffffff',
  },
  
  // Family
  Family: {
    primary: '#10b981',     // emerald-500
    secondary: '#059669',   // emerald-600
    background: '#ecfdf5',  // emerald-50
    hover: '#047857',       // emerald-700
    selected: '#d1fae5',    // emerald-100
    border: '#86efac',      // emerald-200
    text: '#065f46',        // emerald-800
    contrastText: '#ffffff',
  },
  
  // Travel
  Travel: {
    primary: '#8b5cf6',     // violet-500
    secondary: '#7c3aed',   // violet-600
    background: '#f5f3ff',  // violet-50
    hover: '#6d28d9',       // violet-700
    selected: '#e9d5ff',    // violet-100
    border: '#c4b5fd',      // violet-200
    text: '#5b21b6',        // violet-800
    contrastText: '#ffffff',
  },
  
  // Investments
  Investments: {
    primary: '#0ea5e9',     // sky-500
    secondary: '#0284c7',   // sky-600
    background: '#f0f9ff',  // sky-50
    hover: '#0369a1',       // sky-700
    selected: '#e0f2fe',    // sky-100
    border: '#7dd3fc',      // sky-200
    text: '#0c4a6e',        // sky-800
    contrastText: '#ffffff',
  },
  
  // Savings
  Savings: {
    primary: '#059669',     // emerald-600
    secondary: '#047857',   // emerald-700
    background: '#ecfdf5',  // emerald-50
    hover: '#065f46',       // emerald-800
    selected: '#d1fae5',    // emerald-100
    border: '#86efac',      // emerald-200
    text: '#064e3b',        // emerald-900
    contrastText: '#ffffff',
  },
  
  // Cash/Miscellaneous
  Cash: {
    primary: '#6b7280',     // gray-500
    secondary: '#4b5563',   // gray-600
    background: '#f9fafb',  // gray-50
    hover: '#374151',       // gray-700
    selected: '#f3f4f6',    // gray-100
    border: '#d1d5db',      // gray-200
    text: '#1f2937',        // gray-800
    contrastText: '#ffffff',
  },
  
  // Default fallback
  Miscellaneous: {
    primary: '#6b7280',     // gray-500
    secondary: '#4b5563',   // gray-600
    background: '#f9fafb',  // gray-50
    hover: '#374151',       // gray-700
    selected: '#f3f4f6',    // gray-100
    border: '#d1d5db',      // gray-200
    text: '#1f2937',        // gray-800
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
