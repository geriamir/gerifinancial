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

const transactionTypes: { value: TransactionType | undefined; label: string }[] = [
  { value: undefined, label: 'All Types' },
  { value: 'Expense', label: 'Expense' },
  { value: 'Income', label: 'Income' },
  { value: 'Transfer', label: 'Transfer' },
];

interface CategorySelectProps {
  onFilterChange: FilterPanelProps['onFilterChange'];
}

const CategorySelectBase: React.FC<CategorySelectProps> = ({ onFilterChange }) => {
  const { categories } = useCategories();
  const { announce } = useAnnouncer();
  const performance = usePerformanceMonitor('CategorySelect');
  const pendingOperationsRef = useRef<AbortController[]>([]);

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

  useEffect(() => {
    document.addEventListener('keypress', handleKeyPress);
    return () => {
      document.removeEventListener('keypress', handleKeyPress);
      pendingOperationsRef.current.forEach(controller => {
        controller.abort();
      });
      pendingOperationsRef.current = [];
      performance.clearMetrics();
    };
  }, [handleKeyPress, performance]);

  useEffect(() => {
    if (searchString) {
      announce(`Quick search: ${searchString}`);
      void performance.measureOperation('quickSearch', async () => {});
    }
  }, [searchString, announce, performance]);

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

const CategorySelect = React.memo(CategorySelectBase);
CategorySelect.displayName = 'CategorySelect';

const FilterPanel: React.FC<FilterPanelProps> = ({
  startDate = defaultStartDate,
  endDate = defaultEndDate,
  type = undefined,
  search = '',
  onFilterChange,
}) => {
  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebounce(searchInput, 300);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const performance = usePerformanceMonitor('FilterPanel');
  const pendingOperationsRef = useRef<AbortController[]>([]);
  const { announcement, isAssertive, announce } = useAnnouncer();

  useLayoutEffect(() => {
    performance.startOperation('initialRender');
    return () => {
      performance.endOperation('initialRender');
      performance.clearMetrics();
    };
  }, [performance]);

  const handleClearSearch = useCallback(async () => {
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
  }, [performance, announce]);

  const handleTypeChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newType = event.target.value as TransactionType | '';
    console.log('Type filter selection:', { 
      rawValue: event.target.value,
      newType,
      isValidType: ['Expense', 'Income', 'Transfer'].includes(newType)
    });
    const controller = new AbortController();
    pendingOperationsRef.current.push(controller);

    try {
      await performance.measureOperation('typeFilter', async () => {
        if (controller.signal.aborted) return;

        // Validate the type before applying filter
        const validTypes = ['Expense', 'Income', 'Transfer'] as const;
        const typeFilter = newType === '' ? undefined : 
                         validTypes.includes(newType as typeof validTypes[number]) ? newType as TransactionType : 
                         undefined;
        
        console.log('Type filter validation:', {
          rawValue: newType,
          validatedType: typeFilter,
          isValid: typeFilter === undefined || validTypes.includes(typeFilter as typeof validTypes[number])
        });

        onFilterChange({ type: typeFilter });
        announce(formatFilterAnnouncement('Transaction type', newType || 'All types'));
      });
    } finally {
      const index = pendingOperationsRef.current.indexOf(controller);
      if (index > -1) {
        pendingOperationsRef.current.splice(index, 1);
      }
    }
  }, [onFilterChange, announce, performance]);

  const handleFocusSearch = useCallback((e: KeyboardEvent) => {
    e.preventDefault();
    searchInputRef.current?.focus();
  }, []);

  const handleAltT = useCallback(() => {
    const currentIndex = transactionTypes.findIndex(t => t.value === type);
    const nextIndex = (currentIndex + 1) % transactionTypes.length;
    void handleTypeChange({
      target: { value: transactionTypes[nextIndex].value }
    } as React.ChangeEvent<HTMLInputElement>);
  }, [type, handleTypeChange]);

  useKeyboardShortcut({ key: 'f', ctrlKey: true }, handleFocusSearch);
  useKeyboardShortcut({ key: 'r', ctrlKey: true }, handleClearSearch);
  useKeyboardShortcut({ key: 't', altKey: true }, handleAltT);

  useEffect(() => {
    return () => {
      pendingOperationsRef.current.forEach(controller => {
        controller.abort();
      });
      pendingOperationsRef.current = [];
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    pendingOperationsRef.current.push(controller);

    void performance.measureOperation('searchFilter', async () => {
      if (controller.signal.aborted) return;
      onFilterChange({ search: debouncedSearch || undefined });
    });

    return () => {
      const index = pendingOperationsRef.current.indexOf(controller);
      if (index > -1) {
        pendingOperationsRef.current.splice(index, 1);
      }
    };
  }, [debouncedSearch, onFilterChange, performance]);

  const handleDateChange = useCallback((field: 'startDate' | 'endDate') => async (date: Date | null) => {
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
  }, [onFilterChange, announce, performance]);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    performance.startOperation('searchInput');
    const value = event.target.value;
    setSearchInput(value);
    if (!value) {
      announce('Search cleared');
    }
    performance.endOperation('searchInput');
  }, [performance, announce]);

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
          format="dd/MM/yyyy"
          data-testid="date-range-filter"
          slotProps={{ 
            textField: { 
              size: 'small',
              'aria-label': 'Filter from date',
              inputProps: {
                'data-testid': 'date-range-filter'
              }
            }
          }}
        />
        <DatePicker
          label="End Date"
          value={endDate}
          onChange={handleDateChange('endDate')}
          format="dd/MM/yyyy"
          data-testid= 'date-range-end-filter'
          slotProps={{ 
            textField: { 
              size: 'small',
              'aria-label': 'Filter to date',
              inputProps: {
                'data-testid': 'date-range-end-filter'
              }
            } 
          }}
        />
        <Tooltip title="Press Alt+T to cycle through types">
          <TextField
            select
            size="small"
            label="Type"
            value={type || undefined}
            onChange={handleTypeChange}
            sx={{ minWidth: 120 }}
            aria-label="Filter by transaction type"
            data-testid="type-filter"
            SelectProps={{
              displayEmpty: true,
              MenuProps: {
                anchorOrigin: {
                  vertical: 'bottom',
                  horizontal: 'left'
                }
              }
            }}
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
        data-testid="search-input"
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

const MemoizedFilterPanel = React.memo(FilterPanel, (prevProps, nextProps) => {
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
