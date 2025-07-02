export interface Category {
  _id: string;
  name: string;
  type: string;
}

export interface SubCategory {
  _id: string;
  name: string;
  parentCategory: Category;
  keywords: string[];
  isDefault: boolean;
}
