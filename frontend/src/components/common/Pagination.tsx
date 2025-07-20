import React from 'react';
import {
  Box,
  IconButton,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  SelectChangeEvent,
  Tooltip
} from '@mui/material';
import {
  FirstPage,
  LastPage,
  NavigateNext,
  NavigateBefore
} from '@mui/icons-material';

interface PaginationProps {
  currentPage: number;
  pageSize: number;
  total: number;
  loading?: boolean;
  pageSizeOptions?: number[];
  showFirstLast?: boolean;
  showPageSize?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
  'aria-label'?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  pageSize,
  total,
  loading = false,
  pageSizeOptions = [10, 20, 50, 100],
  showFirstLast = true,
  showPageSize = true,
  onPageChange,
  onPageSizeChange,
  className,
  'aria-label': ariaLabel = 'Pagination navigation'
}) => {
  // Sanitize inputs
  const sanitizedTotal = Math.max(0, Number.isFinite(total) ? total : 0);
  const sanitizedPageSize = Math.min(
    Math.max(pageSizeOptions[0], Number.isFinite(pageSize) ? pageSize : pageSizeOptions[0]),
    pageSizeOptions[pageSizeOptions.length - 1]
  );
  const totalPages = Math.max(1, Math.ceil(sanitizedTotal / sanitizedPageSize));
  const sanitizedCurrentPage = Math.min(
    Math.max(0, Number.isFinite(currentPage) ? currentPage : 0),
    Math.max(0, totalPages - 1)
  );
  const isFirstPage = sanitizedCurrentPage <= 0;
  const isLastPage = sanitizedCurrentPage >= totalPages - 1;

  const handlePageSize = (event: SelectChangeEvent<number>) => {
    const newSize = Number(event.target.value);
    onPageSizeChange?.(newSize);
  };

  const goToPage = (page: number) => {
    if (page >= 0 && page < totalPages && !loading) {
      onPageChange(page);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowLeft':
        if (!isFirstPage && !loading) {
          goToPage(sanitizedCurrentPage - 1);
        }
        break;
      case 'ArrowRight':
        if (!isLastPage && !loading) {
          goToPage(sanitizedCurrentPage + 1);
        }
        break;
      case 'Home':
        if (!isFirstPage && !loading) {
          goToPage(0);
        }
        break;
      case 'End':
        if (!isLastPage && !loading) {
          goToPage(totalPages - 1);
        }
        break;
    }
  };

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={2}
      className={className}
      role="navigation"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {showPageSize && (
        <FormControl size="small" variant="outlined">
          <InputLabel id="page-size-label">Items per page</InputLabel>
          <Select
            labelId="page-size-label"
            id="pagination-items"
            value={sanitizedPageSize}
            onChange={handlePageSize}
            label="Items per page"
            disabled={loading}
            aria-controls="pagination-items"
            aria-label="Select number of items per page"
          >
            {pageSizeOptions.map(size => (
              <MenuItem key={size} value={size}>
                {size} items
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      <Stack direction="row" alignItems="center" spacing={1}>
        {showFirstLast && (
          <Tooltip title="First page">
            <span>
              <IconButton
                onClick={() => goToPage(0)}
                disabled={isFirstPage || loading}
                size="small"
                aria-label="First page"
              >
                <FirstPage />
              </IconButton>
            </span>
          </Tooltip>
        )}

        <Tooltip title="Previous page">
          <span>
            <IconButton
              onClick={() => goToPage(sanitizedCurrentPage - 1)}
              disabled={isFirstPage || loading}
              size="small"
              aria-label="Previous page"
            >
              <NavigateBefore />
            </IconButton>
          </span>
        </Tooltip>

        <Box sx={{ mx: 2, minWidth: 100, textAlign: 'center' }}>
          <Typography 
            variant="body2" 
            color="text.secondary"
            role="status"
            id="pagination-status"
            aria-live="polite"
          >
            Page {sanitizedCurrentPage + 1} of {totalPages}
          </Typography>
          <Typography 
            variant="caption" 
            color="text.secondary" 
            display="block"
            aria-labelledby="pagination-status"
          >
            {sanitizedTotal} {sanitizedTotal === 1 ? 'item' : 'items'}
          </Typography>
        </Box>

        <Tooltip title="Next page">
          <span>
            <IconButton
              onClick={() => goToPage(sanitizedCurrentPage + 1)}
              disabled={isLastPage || loading}
              size="small"
              aria-label="Next page"
            >
              <NavigateNext />
            </IconButton>
          </span>
        </Tooltip>

        {showFirstLast && (
          <Tooltip title="Last page">
            <span>
              <IconButton
                onClick={() => goToPage(totalPages - 1)}
                disabled={isLastPage || loading}
                size="small"
                aria-label="Last page"
              >
                <LastPage />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Stack>
    </Stack>
  );
};

interface InfiniteScrollProps<T> {
  items: T[];
  loading?: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  threshold?: number;
  loadingIndicator?: React.ReactNode;
  children: (items: T[]) => React.ReactNode;
  className?: string;
  'aria-label'?: string;
}

export function InfiniteScroll<T>({
  items,
  loading = false,
  hasMore,
  onLoadMore,
  threshold = 200,
  loadingIndicator = <Box sx={{ py: 2 }}>Loading more items...</Box>,
  children,
  className,
  'aria-label': ariaLabel = 'Infinite scroll content'
}: InfiniteScrollProps<T>) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const checkScroll = () => {
      const container = containerRef.current;
      if (!container || loading || !hasMore) return;

      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight - scrollTop - clientHeight < threshold) {
        onLoadMore();
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScroll);
      return () => container.removeEventListener('scroll', checkScroll);
    }
  }, [loading, hasMore, threshold, onLoadMore]);

  return (
    <Box
      ref={containerRef}
      className={className}
      sx={{
        overflowY: 'auto',
        height: '100%'
      }}
      role="feed"
      aria-busy={loading}
      aria-label={ariaLabel}
    >
      {children(items)}
      {loading && (
        <Box role="status" aria-live="polite">
          {loadingIndicator}
        </Box>
      )}
      {!loading && !hasMore && items.length > 0 && (
        <Box 
          role="status" 
          aria-live="polite"
          sx={{ py: 2, textAlign: 'center' }}
        >
          No more items to load
        </Box>
      )}
    </Box>
  );
}
