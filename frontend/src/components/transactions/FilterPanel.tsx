import React, { useMemo, useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import {
  Box,
  TextField,
  MenuItem,
  IconButton,
  InputAdornment,
  Stack,
  Tooltip,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { Clear as ClearIcon, Search as SearchIcon } from '@mui/icons-material';
import { TransactionType } from '../../services/api/types';
import { useCategories } from '../../hooks/useCategories';
import { useDebounce } from '../../hooks/useDebounce';
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut';
import { useAnnouncer, formatFilterAnnouncement } from '../../hooks/useAnnouncer';
import { useCategoryQuickSearch } from '../../hooks/useCategoryQuickSearch';
import { usePerformanceMonitor } from '../../hooks/usePerformanceMonitor';
import LiveAnnouncer from '../common/LiveAnnouncer';
import PerformanceMonitor from '../dev/PerformanceMonitor';

/**
 * Operation handling in FilterPanel:
 * - All async operations (filters, searches, etc.) are tracked and can be cancelled
 * - Uses AbortController to handle operation cancellation on unmount or during rapid changes
 * - Operations are automatically cleaned up to prevent memory leaks
 * - Each operation tracks its own performance metrics
 * 
 * Performance considerations:
 * - Operations are debounced where appropriate
 * - Pending operations are cancelled when component unmounts
 * - Performance metrics are logged in development mode
 */
interface FilterPanelProps {
  startDate?: Date;
  endDate?: Date;
  type?: TransactionType;
  category?: string;
  search?: string;
  onFilterChange: (filters: {
    startDate?: Date;
    endDate?: Date;
    type?: TransactionType;
    category?: string;
    search?: string;
  }) => void;
}

const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
const defaultEndDate = new Date();

const transactionTypes: { value: TransactionType | ''; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'Expense', label: 'Expense' },
  { value: 'Income', label: 'Income' },
  { value: 'Transfer', label: 'Transfer' },
];

interface CategorySelectProps {
  onFilterChange: FilterPanelProps['onFilterChange'];
}

interface PendingOperation {
  controller: AbortController;
  operationName: string;
  startTime: number;
}

const CategorySelectBase: React.FC<CategorySelectProps> = ({ onFilterChange }) => {
  const { categories, loading, error } = useCategories();
  const { announce } = useAnnouncer();
  const performance = usePerformanceMonitor('CategorySelect');
  const pendingOperationsRef = useRef<AbortController[]>([]);

  // Clean up any pending operations on unmount
  useEffect(() => {
    return () => {
      pendingOperationsRef.current.forEach(controller => {
        controller.abort();
      });
      pendingOperationsRef.current = [];
    };
  }, []);

  const sortedCategories = useMemo(() => {
    performance.startOperation('sortCategories');
    const sorted = categories.sort((a, b) => a.name.localeCompare(b.name));
    performance.endOperation('sortCategories');
    return sorted;
  }, [categories, performance]);

  const handleCategorySelect = useCallback(async (categoryId: string) => {
    const controller = new AbortController();
    pendingOperationsRef.current.push(controller);

    try {
      await performance.measureOperation('categorySelect', async () => {
        if (controller.signal.aborted) return;
        onFilterChange({ category: categoryId || undefined });
        const selectedCategory = categories.find(c => c._id === categoryId);
        if (selectedCategory) {
          announce(`Selected category ${selectedCategory.name}`);
        }
      });
    } finally {
      const index = pendingOperationsRef.current.indexOf(controller);
      if (index > -1) {
        pendingOperationsRef.current.splice(index, 1);
      }
    }
  }, [categories, onFilterChange, announce, performance]);

  const { searchString, handleKeyPress } = useCategoryQuickSearch(
    sortedCategories,
    handleCategorySelect
  );

  // Clean up performance metrics and event listeners on unmount
  useEffect(() => {
    document.addEventListener('keypress', handleKeyPress);
    return () => {
      document.removeEventListener('keypress', handleKeyPress);
      performance.clearMetrics();
    };
  }, [handleKeyPress, performance]);

  useEffect(() => {
    if (searchString) {
      announce(`Quick search: ${searchString}`);
      performance.measureOperation('quickSearch', async () => {});
    }
  }, [searchString, announce, performance]);

  // ... rest of CategorySelect code remains the same ...
  // (keeping the rendering part unchanged)

  return (
    <Box sx={{ position: 'relative' }}>
      <TextField
        select
        size="small"
        label="Category"
        defaultValue=""
        onChange={(e) => handleCategorySelect(e.target.value)}
        sx={{ minWidth: 120 }}
        aria-label="Filter by category"
        title="Type to quickly search categories"
      >
        <MenuItem value="">All Categories</MenuItem>
        {sortedCategories.map((category) => (
          <MenuItem key={category._id} value={category._id}>
            {category.name}
          </MenuItem>
        ))}
      </TextField>
      {searchString && (
        <Box
          sx={{
            position: 'absolute',
            bottom: -20,
            left: 0,
            fontSize: '0.75rem',
            color: 'text.secondary',
          }}
        >
          Quick search: {searchString}
        </Box>
      )}
    </Box>
  );
};

/**
 * Memoized version of CategorySelect component.
 * Uses default memo equality check since the component only receives onFilterChange prop,
 * and React's default prop comparison is sufficient for this case.
 * 
 * Performance considerations:
 * 1. Prevents re-renders when parent FilterPanel updates unrelated state
 * 2. Maintains sorted categories list via useMemo
 * 3. Optimizes quick search functionality with useCallback
 */
const CategorySelect = React.memo(CategorySelectBase);
CategorySelect.displayName = 'CategorySelect';

const FilterPanel: React.FC<FilterPanelProps> = ({
  startDate = defaultStartDate,
  endDate = defaultEndDate,
  type = '',
  search = '',
  onFilterChange,
}) => {
  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebounce(searchInput, 300);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const performance = usePerformanceMonitor('FilterPanel');
  const pendingOperationsRef = useRef<AbortController[]>([]);

  // Clean up any pending operations on unmount
  useEffect(() => {
    return () => {
      pendingOperationsRef.current.forEach(controller => {
        controller.abort();
      });
      pendingOperationsRef.current = [];
    };
  }, []);

  // Track initial render time and clean up performance metrics on unmount
  useLayoutEffect(() => {
    performance.startOperation('initialRender');
    return () => {
      performance.endOperation('initialRender');
      // Clear performance metrics to prevent memory leaks
      performance.clearMetrics();
    };
  }, [performance]);

  // Keyboard shortcuts
  useKeyboardShortcut({ key: 'f', ctrlKey: true }, (e) => {
    e.preventDefault();
    searchInputRef.current?.focus();
  });

  useKeyboardShortcut({ key: 'r', ctrlKey: true }, (e) => {
    e.preventDefault();
    handleClearSearch();
  });

  useKeyboardShortcut({ key: 't', altKey: true }, () => {
    const currentIndex = transactionTypes.findIndex(t => t.value === type);
    const nextIndex = (currentIndex + 1) % transactionTypes.length;
    handleTypeChange({
      target: { value: transactionTypes[nextIndex].value }
    } as React.ChangeEvent<HTMLInputElement>);
  });

  useEffect(() => {
    const controller = new AbortController();
    pendingOperationsRef.current.push(controller);

    try {
      performance.measureOperation('searchFilter', async () => {
        if (controller.signal.aborted) return;
        onFilterChange({ search: debouncedSearch || undefined });
      });
    } finally {
      const index = pendingOperationsRef.current.indexOf(controller);
      if (index > -1) {
        pendingOperationsRef.current.splice(index, 1);
      }
    }
  }, [debouncedSearch, onFilterChange, performance]);

  const { announcement, isAssertive, announce } = useAnnouncer();

  const handleDateChange = (field: 'startDate' | 'endDate') => async (date: Date | null) => {
    if (date) {
      const controller = new AbortController();
      pendingOperationsRef.current.push(controller);

      try {
        await performance.measureOperation('dateFilter', async () => {
          if (controller.signal.aborted) return;
          onFilterChange({ [field]: date });
          announce(formatFilterAnnouncement(field, date));
        });
      } finally {
        const index = pendingOperationsRef.current.indexOf(controller);
        if (index > -1) {
          pendingOperationsRef.current.splice(index, 1);
        }
      }
    }
  };

  const handleTypeChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newType = event.target.value as TransactionType | '';
    const controller = new AbortController();
    pendingOperationsRef.current.push(controller);

    try {
      await performance.measureOperation('typeFilter', async () => {
        if (controller.signal.aborted) return;
        onFilterChange({ type: newType || undefined });
        announce(formatFilterAnnouncement('Transaction type', newType || 'All types'));
      });
    } finally {
      const index = pendingOperationsRef.current.indexOf(controller);
      if (index > -1) {
        pendingOperationsRef.current.splice(index, 1);
      }
    }
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    performance.startOperation('searchInput');
    const value = event.target.value;
    setSearchInput(value);
    if (!value) {
      announce('Search cleared');
    }
    performance.endOperation('searchInput');
  };

  const handleClearSearch = async () => {
    const controller = new AbortController();
    pendingOperationsRef.current.push(controller);

    try {
      await performance.measureOperation('clearSearch', async () => {
        if (controller.signal.aborted) return;
        setSearchInput('');
        announce('Search cleared');
      });
    } finally {
      const index = pendingOperationsRef.current.indexOf(controller);
      if (index > -1) {
        pendingOperationsRef.current.splice(index, 1);
      }
    }
  };

  // Rest of the rendering code remains the same
  const { metrics } = performance.getMetrics();

  return (
    <Box 
      sx={{ mb: 3 }}
      role="search"
      aria-label="Transaction filters"
    >
      {process.env.NODE_ENV === 'development' && (
        <PerformanceMonitor
          componentName="FilterPanel"
          metrics={metrics}
        />
      )}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems="center"
        sx={{ mb: 2 }}
        role="group"
        aria-label="Filter controls"
      >
        <DatePicker
          label="Start Date"
          value={startDate}
          onChange={handleDateChange('startDate')}
          slotProps={{ 
            textField: { 
              size: 'small',
              'aria-label': 'Filter from date' 
            } 
          }}
        />
        <DatePicker
          label="End Date"
          value={endDate}
          onChange={handleDateChange('endDate')}
          slotProps={{ 
            textField: { 
              size: 'small',
              'aria-label': 'Filter to date'
            } 
          }}
        />
        <Tooltip title="Press Alt+T to cycle through types">
          <TextField
            select
            size="small"
            label="Type"
            value={type}
            onChange={handleTypeChange}
            sx={{ minWidth: 120 }}
            aria-label="Filter by transaction type"
          >
            {transactionTypes.map(option => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Tooltip>
        <CategorySelect onFilterChange={onFilterChange} />
      </Stack>
      
      <TextField
        fullWidth
        size="small"
        label="Search transactions (Ctrl+F)"
        value={searchInput}
        onChange={handleSearchChange}
        inputRef={searchInputRef}
        placeholder="Search by description..."
        aria-label="Search transactions by description"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon aria-hidden="true" />
            </InputAdornment>
          ),
          endAdornment: searchInput ? (
            <InputAdornment position="end">
              <Tooltip title="Clear search (Ctrl+R)">
                <IconButton
                  size="small"
                  onClick={handleClearSearch}
                  edge="end"
                  aria-label="Clear search"
                >
                  <ClearIcon aria-hidden="true" />
                </IconButton>
              </Tooltip>
            </InputAdornment>
          ) : null,
        }}
      />
      <LiveAnnouncer message={announcement} assertive={isAssertive} />
    </Box>
  );
};

/**
 * Memoized version of FilterPanel with custom equality check.
 * The comparison function ensures we only re-render when the actual filter values change.
 * Special handling is included for Date objects since they need to be compared by value.
 * Performance improvement targets:
 * 1. Prevent re-renders when parent components update but filters haven't changed
 * 2. Optimize date comparison to avoid unnecessary re-renders
 * 3. Maintain referential equality for callback functions
 * 
 * Note: The CategorySelect component is also memoized separately to optimize
 * the category list rendering and quick search functionality.
 */
const MemoizedFilterPanel = React.memo(FilterPanel, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders when filters haven't changed
  return (
    prevProps.startDate?.getTime() === nextProps.startDate?.getTime() &&
    prevProps.endDate?.getTime() === nextProps.endDate?.getTime() &&
    prevProps.type === nextProps.type &&
    prevProps.category === nextProps.category &&
    prevProps.search === nextProps.search
  );
});

MemoizedFilterPanel.displayName = 'FilterPanel';

export default MemoizedFilterPanel;
