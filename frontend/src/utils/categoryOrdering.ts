import { DefaultCategory } from '../services/api/categories';

/**
 * Sort categories according to the default order defined in userCategoryService
 */
export function sortCategoriesByDefaultOrder(
  categories: string[],
  defaultCategories: DefaultCategory[],
  type: 'Income' | 'Expense' | 'Transfer'
): string[] {
  const categoryOrder = defaultCategories
    .filter(cat => cat.type === type)
    .map(cat => cat.name);

  return categories.sort((a, b) => {
    // Handle undefined or null category names
    const categoryA = a || '';
    const categoryB = b || '';
    
    if (!categoryA && !categoryB) return 0;
    if (!categoryA) return 1;
    if (!categoryB) return -1;
    
    const indexA = categoryOrder.indexOf(categoryA);
    const indexB = categoryOrder.indexOf(categoryB);
    
    // If both categories are in the order array, sort by their index
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }
    
    // If only one is in the order array, it comes first
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    
    // If neither is in the order array, sort alphabetically
    return categoryA.localeCompare(categoryB);
  });
}

/**
 * Sort subcategories according to their parent category's subcategory order
 */
export function sortSubcategoriesByDefaultOrder(
  subcategories: any[],
  parentCategory: string,
  defaultCategories: DefaultCategory[]
): any[] {
  const categoryConfig = defaultCategories.find(cat => cat.name === parentCategory);
  const subcategoryOrder = categoryConfig?.subCategories?.map(sub => sub.name) || [];
  
  return subcategories.sort((a, b) => {
    // Extract name from budget expense object
    let nameA = '';
    let nameB = '';
    
    if (typeof a === 'string') {
      nameA = a;
    } else if (a?.name) {
      nameA = a.name;
    } else if (a?.subCategoryId) {
      // Handle budget expense object structure
      nameA = typeof a.subCategoryId === 'object' 
        ? (a.subCategoryId as any)?.name || ''
        : a.subCategoryId || '';
    }
    
    if (typeof b === 'string') {
      nameB = b;
    } else if (b?.name) {
      nameB = b.name;
    } else if (b?.subCategoryId) {
      // Handle budget expense object structure
      nameB = typeof b.subCategoryId === 'object' 
        ? (b.subCategoryId as any)?.name || ''
        : b.subCategoryId || '';
    }
    
    // Handle empty or undefined names
    if (!nameA && !nameB) return 0;
    if (!nameA) return 1;
    if (!nameB) return -1;
    
    const indexA = subcategoryOrder.indexOf(nameA);
    const indexB = subcategoryOrder.indexOf(nameB);
    
    // If both subcategories are in the order array, sort by their index
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }
    
    // If only one is in the order array, it comes first
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    
    // If neither is in the order array, sort alphabetically
    return nameA.localeCompare(nameB);
  });
}

/**
 * Sort grouped expenses/income by default category order
 */
export function sortGroupedCategoriesByDefaultOrder(
  groupedCategories: Record<string, any[]>,
  defaultCategories: DefaultCategory[],
  type: 'Income' | 'Expense' | 'Transfer'
): Array<[string, any[]]> {
  const categoryNames = Object.keys(groupedCategories);
  const sortedCategoryNames = sortCategoriesByDefaultOrder(categoryNames, defaultCategories, type);
  
  return sortedCategoryNames.map(categoryName => [
    categoryName,
    sortSubcategoriesByDefaultOrder(
      groupedCategories[categoryName], 
      categoryName, 
      defaultCategories
    )
  ]);
}
