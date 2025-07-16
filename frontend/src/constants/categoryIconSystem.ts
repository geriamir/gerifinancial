/**
 * Category Icon System
 * 
 * This module provides a comprehensive mapping between categories/subcategories
 * and their corresponding PNG icons, with intelligent fallback logic and
 * theme integration.
 * 
 * Features:
 * - PNG icon mapping with fallback to Material-UI icons
 * - Category-specific color theming
 * - Smart name matching for icon lookup
 * - Subcategory to category inheritance
 * - Performance optimized with caching
 * 
 * @module categoryIconSystem
 */

import { getCategoryTheme, getTransactionTypeTheme, CategoryTheme } from './categoryThemes';

/**
 * Represents a complete icon configuration for a category
 */
export interface CategoryIconConfig {
  /** Path to the PNG icon file */
  iconPath: string;
  /** Primary color theme for the category */
  theme: CategoryTheme;
  /** Alternative names/aliases for the category */
  aliases?: string[];
  /** Fallback icon name if PNG fails to load */
  fallbackIcon?: string;
  /** Whether this is a default/fallback configuration */
  isDefault?: boolean;
}

/**
 * Available PNG icon files in the public/icons/categories directory
 */
export const availableIcons = [
  'allowancegreen.png',
  'cars.png',
  'cash.png',
  'credit card.png',
  'dividendsandprofits.png',
  'eatingout.png',
  'entertainment.png',
  'family.png',
  'financialservices.png',
  'health.png',
  'household.png',
  'income-misc.png',
  'investments.png',
  'misc.png',
  'refunds.png',
  'salary.png',
  'savings.png',
  'shopping.png',
  'travel.png',
] as const;

/**
 * Type for available icon names
 */
export type AvailableIconName = typeof availableIcons[number];

/**
 * Comprehensive mapping of categories to their icon configurations
 */
export const categoryIconConfigs: Record<string, CategoryIconConfig> = {
  // Income categories
  'Salary': {
    iconPath: '/icons/categories/salary.png',
    theme: getCategoryTheme('Salary'),
    aliases: ['salary', 'wage', 'payroll', 'employment income'],
  },
  'Dividends and Profits': {
    iconPath: '/icons/categories/dividendsandprofits.png',
    theme: getCategoryTheme('Investments'),
    aliases: ['dividends', 'profits', 'investment income', 'stock dividends'],
  },
  'Allowance': {
    iconPath: '/icons/categories/allowancegreen.png',
    theme: getCategoryTheme('Allowance'),
    aliases: ['allowance', 'pocket money', 'stipend'],
  },
  'Refunds': {
    iconPath: '/icons/categories/refunds.png',
    theme: getCategoryTheme('Refunds'),
    aliases: ['refund', 'return', 'reimbursement'],
  },
  'Income - Miscellaneous': {
    iconPath: '/icons/categories/income-misc.png',
    theme: getTransactionTypeTheme('Income'),
    aliases: ['income misc', 'other income', 'miscellaneous income'],
  },
  
  // Expense categories
  'Household': {
    iconPath: '/icons/categories/household.png',
    theme: getCategoryTheme('Household'),
    aliases: ['household', 'home', 'house', 'domestic'],
  },
  'Health': {
    iconPath: '/icons/categories/health.png',
    theme: getCategoryTheme('Health'),
    aliases: ['health', 'medical', 'healthcare', 'medicine'],
  },
  'Cars and Transportation': {
    iconPath: '/icons/categories/cars.png',
    theme: getCategoryTheme('Cars and Transportation'),
    aliases: ['cars', 'vehicle', 'automobile', 'transportation', 'transport', 'cars and transportation'],
  },
  'Eating Out': {
    iconPath: '/icons/categories/eatingout.png',
    theme: getCategoryTheme('Eating Out'),
    aliases: ['eating out', 'restaurant', 'dining', 'food'],
  },
  'Entertainment': {
    iconPath: '/icons/categories/entertainment.png',
    theme: getCategoryTheme('Entertainment'),
    aliases: ['entertainment', 'leisure', 'recreation', 'fun'],
  },
  'Family': {
    iconPath: '/icons/categories/family.png',
    theme: getCategoryTheme('Family'),
    aliases: ['family', 'children', 'kids', 'childcare'],
  },
  'Shopping': {
    iconPath: '/icons/categories/shopping.png',
    theme: getCategoryTheme('Shopping'),
    aliases: ['shopping', 'retail', 'purchases', 'buying'],
  },
  'Travel': {
    iconPath: '/icons/categories/travel.png',
    theme: getCategoryTheme('Travel'),
    aliases: ['travel', 'vacation', 'trip', 'tourism'],
  },
  
  // Financial categories
  'Financial Services': {
    iconPath: '/icons/categories/financialservices.png',
    theme: getCategoryTheme('Financial Services'),
    aliases: ['financial services', 'banking', 'finance', 'financial'],
  },
  'Credit Card': {
    iconPath: '/icons/categories/credit card.png',
    theme: getCategoryTheme('Financial Services'),
    aliases: ['credit card', 'card payment', 'credit'],
  },
  'Investments': {
    iconPath: '/icons/categories/investments.png',
    theme: getCategoryTheme('Investments'),
    aliases: ['investments', 'stocks', 'bonds', 'portfolio'],
  },
  'Savings': {
    iconPath: '/icons/categories/savings.png',
    theme: getCategoryTheme('Savings'),
    aliases: ['savings', 'save', 'deposit'],
  },
  
  // Default/fallback categories
  'Cash': {
    iconPath: '/icons/categories/cash.png',
    theme: getCategoryTheme('Cash Withdrawal'),
    aliases: ['cash', 'money', 'currency'],
  },
  'Miscellaneous': {
    iconPath: '/icons/categories/misc.png',
    theme: getCategoryTheme('Miscellaneous'),
    aliases: ['misc', 'miscellaneous', 'other', 'various'],
    isDefault: true,
  },
};

/**
 * Subcategory to category mapping for inheritance
 */
export const subcategoryToCategoryMap: Record<string, string> = {
  // Household subcategories
  'Mortgage': 'Household',
  'Maintenance and Repairs': 'Household',
  'Property Tax': 'Household',
  'Cleaning and Laundry': 'Household',
  'Communication': 'Household',
  'Home Insurance': 'Household',
  'Utilities': 'Household',
  'Gardening': 'Household',
  
  // Shopping subcategories
  'Furniture and Decorations': 'Shopping',
  'Appliances and Electronics': 'Shopping',
  'Groceries': 'Shopping',
  'Apparel and Accessories': 'Shopping',
  
  // Family subcategories
  'Activities': 'Family',
  'Pets': 'Family',
  'School': 'Family',
  'Toys': 'Family',
  'Family Miscellaneous': 'Family',
  
  // Health subcategories
  'Pharm': 'Health',
  'Fitness': 'Health',
  'Health Insurance': 'Health',
  'Grooming': 'Health',
  'Health Services': 'Health',
  'Dental': 'Health',
  'Optometry': 'Health',
  'Health Miscellaneous': 'Health',
  
  // Cars subcategories
  'Car Services': 'Cars and Transportation',
  'Public Transportation': 'Cars and Transportation',
  'Fuel': 'Cars and Transportation',
  'Toll Roads': 'Cars and Transportation',
  'Parking': 'Cars and Transportation',
  'Cars Miscellaneous': 'Cars and Transportation',
  
  // Eating Out subcategories
  'Coffee shops, Restaurant and Pubs': 'Eating Out',
  'Take Away': 'Eating Out',
  'Eating Out - Miscellaneous': 'Eating Out',
  
  // Entertainment subcategories
  'Movies and Shows': 'Entertainment',
  'Music and Reading': 'Entertainment',
  'Entertainment - Miscellaneous': 'Entertainment',
  
  // Travel subcategories
  'Flights': 'Travel',
  'Hotels': 'Travel',
  'Recreation': 'Travel',
  'Travel Transportation': 'Travel',
  'Travel - Miscellaneous': 'Travel',
  
  // Financial subcategories
  'Taxes and Government': 'Financial Services',
  'Fees': 'Financial Services',
};

/**
 * Cache for resolved icon configurations to improve performance
 */
const iconConfigCache = new Map<string, CategoryIconConfig>();

/**
 * Normalize a name for matching (lowercase, remove special chars, etc.)
 */
const normalizeName = (name: string): string => {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Find the best matching icon configuration for a given name
 */
const findMatchingConfig = (name: string): CategoryIconConfig | null => {
  const normalizedName = normalizeName(name);
  
  // Direct match first
  for (const [configName, config] of Object.entries(categoryIconConfigs)) {
    if (normalizeName(configName) === normalizedName) {
      return config;
    }
  }
  
  // Check aliases
  for (const [, config] of Object.entries(categoryIconConfigs)) {
    if (config.aliases) {
      for (const alias of config.aliases) {
        if (normalizeName(alias) === normalizedName) {
          return config;
        }
      }
    }
  }
  
  // Partial match
  for (const [configName, config] of Object.entries(categoryIconConfigs)) {
    if (normalizeName(configName).includes(normalizedName) || 
        normalizedName.includes(normalizeName(configName))) {
      return config;
    }
  }
  
  return null;
};

/**
 * Get icon configuration for a category name
 */
export const getCategoryIconConfig = (categoryName: string): CategoryIconConfig => {
  // Check cache first
  if (iconConfigCache.has(categoryName)) {
    return iconConfigCache.get(categoryName)!;
  }
  
  let config = findMatchingConfig(categoryName);
  
  if (!config) {
    // Try to find through subcategory mapping
    const parentCategory = subcategoryToCategoryMap[categoryName];
    if (parentCategory) {
      config = findMatchingConfig(parentCategory);
    }
  }
  
  // Fallback to default
  if (!config) {
    config = categoryIconConfigs.Miscellaneous;
  }
  
  // Cache the result
  iconConfigCache.set(categoryName, config);
  
  return config;
};

/**
 * Get icon configuration for a subcategory with category inheritance
 */
export const getSubcategoryIconConfig = (subcategoryName: string, categoryName?: string): CategoryIconConfig => {
  const cacheKey = `${subcategoryName}:${categoryName || 'none'}`;
  
  // Check cache first
  if (iconConfigCache.has(cacheKey)) {
    return iconConfigCache.get(cacheKey)!;
  }
  
  let config: CategoryIconConfig | null = null;
  
  // Try direct subcategory match first
  config = findMatchingConfig(subcategoryName);
  
  // If no direct match, try parent category
  if (!config && categoryName) {
    config = findMatchingConfig(categoryName);
  }
  
  // Try subcategory to category mapping
  if (!config) {
    const parentCategory = subcategoryToCategoryMap[subcategoryName];
    if (parentCategory) {
      config = findMatchingConfig(parentCategory);
    }
  }
  
  // Fallback to default
  if (!config) {
    config = categoryIconConfigs.Miscellaneous;
  }
  
  // Cache the result
  iconConfigCache.set(cacheKey, config);
  
  return config;
};

/**
 * Get icon path for a category
 */
export const getCategoryIconPath = (categoryName: string): string => {
  return getCategoryIconConfig(categoryName).iconPath;
};

/**
 * Get icon path for a subcategory
 */
export const getSubcategoryIconPath = (subcategoryName: string, categoryName?: string): string => {
  return getSubcategoryIconConfig(subcategoryName, categoryName).iconPath;
};

/**
 * Get theme for a category
 */
export const getCategoryIconTheme = (categoryName: string): CategoryTheme => {
  return getCategoryIconConfig(categoryName).theme;
};

/**
 * Get theme for a subcategory
 */
export const getSubcategoryIconTheme = (subcategoryName: string, categoryName?: string): CategoryTheme => {
  return getSubcategoryIconConfig(subcategoryName, categoryName).theme;
};

/**
 * Check if an icon exists in the available icons list
 */
export const isIconAvailable = (iconName: string): boolean => {
  return availableIcons.includes(iconName as AvailableIconName);
};

/**
 * Get all available category configurations
 */
export const getAllCategoryConfigs = (): Record<string, CategoryIconConfig> => {
  return categoryIconConfigs;
};

/**
 * Clear the icon configuration cache (useful for testing)
 */
export const clearIconConfigCache = (): void => {
  iconConfigCache.clear();
};
