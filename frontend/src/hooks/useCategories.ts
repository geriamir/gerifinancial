import { useState, useEffect } from 'react';
import { Category } from '../services/api/types/categories';
import { transactionsApi } from '../services/api/transactions';

export const useCategories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await transactionsApi.getCategories();
        setCategories(response);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch categories:', err);
        setError('Failed to load categories');
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  const getSubCategories = (categoryId: string) => {
    const category = categories.find(cat => cat._id === categoryId);
    return category?.subCategories || [];
  };

  return { categories, getSubCategories, loading, error };
};
