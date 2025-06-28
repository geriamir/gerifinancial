import { useState, useCallback, useEffect } from 'react';
import { Category } from '../services/api/types';

const QUICK_SEARCH_TIMEOUT = 1000; // Reset search after 1 second of inactivity

export const useCategoryQuickSearch = (
  categories: Category[],
  onCategorySelect: (categoryId: string) => void
) => {
  const [searchString, setSearchString] = useState('');
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout>();

  // Reset search string after timeout
  useEffect(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (searchString) {
      const id = setTimeout(() => setSearchString(''), QUICK_SEARCH_TIMEOUT);
      setTimeoutId(id);
    }
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [searchString]);

  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    // Only handle alphanumeric keys
    if (event.key.length === 1 && /^[a-zA-Z0-9]$/.test(event.key)) {
      const newSearchString = searchString + event.key.toLowerCase();
      setSearchString(newSearchString);

      // Find first matching category
      const matchingCategory = categories.find(category =>
        category.name.toLowerCase().startsWith(newSearchString)
      );

      if (matchingCategory) {
        onCategorySelect(matchingCategory._id);
      }
    }
  }, [searchString, categories, onCategorySelect]);

  return {
    searchString,
    handleKeyPress,
  };
};
