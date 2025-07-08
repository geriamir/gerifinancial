export interface SubCategory {
  _id: string;
  name: string;
  parentCategory: string | Category;
  userId: string;
  keywords: string[];
  isDefault: boolean;
  rules?: string[];
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  _id: string;
  name: string;
  type: 'Expense' | 'Income' | 'Transfer';
  userId: string;
  subCategories?: SubCategory[];
  rules?: string[];
  isActive?: boolean;
  color?: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}
