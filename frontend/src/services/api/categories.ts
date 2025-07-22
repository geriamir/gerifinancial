import { AxiosResponse } from 'axios';
import api from './base';

interface DefaultCategory {
  name: string;
  type: 'Income' | 'Expense' | 'Transfer';
  keywords: string[];
  subCategories?: Array<{
    name: string;
    keywords: string[];
  }>;
}

interface DefaultCategoriesResponse {
  categories: DefaultCategory[];
  incomeCategories: DefaultCategory[];
  expenseCategories: DefaultCategory[];
  transferCategories: DefaultCategory[];
}

export const categoriesApi = {
  /**
   * Get default category structure and ordering
   */
  getDefaultOrder: (): Promise<DefaultCategoriesResponse> =>
    api.get('/budgets/categories/default-order')
      .then((res: AxiosResponse<{ success: boolean; data: DefaultCategoriesResponse }>) => res.data.data)
};

export type { DefaultCategory, DefaultCategoriesResponse };
