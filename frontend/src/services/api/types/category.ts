export interface SubCategory {
  _id: string;
  name: string;
  rules?: string[];
  parent: string;
  isActive?: boolean;
}

export interface Category {
  _id: string;
  name: string;
  type: 'Expense' | 'Income' | 'Transfer';
  rules?: string[];
  subCategories: SubCategory[];
  isActive?: boolean;
  color?: string;
  icon?: string;
}
