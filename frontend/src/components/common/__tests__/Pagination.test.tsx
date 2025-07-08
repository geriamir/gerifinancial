import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { Pagination, InfiniteScroll } from '../Pagination';

interface TestSetupResult {
  container: HTMLElement;
}

interface PaginationProps {
  currentPage: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  loading?: boolean;
}

interface InfiniteScrollItem {
  id: number;
  name: string;
}

interface InfiniteScrollProps<T> {
  items: T[];
  hasMore: boolean;
  onLoadMore: () => void;
  loading?: boolean;
  threshold?: number;
  children: (items: T[]) => React.ReactNode;
}
interface ErrorState {
  hasError: boolean;
  error: Error | null;
}

// Mock error boundary for testing
class TestErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorState> {
  state: ErrorState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return <div role="alert">Error: {this.state.error.message}</div>;
    }
    return this.props.children;
  }
}

describe('Pagination', () => {
  const defaultProps: PaginationProps = {
    currentPage: 0,
    pageSize: 20,
    total: 100,
    onPageChange: jest.fn(),
    onPageSizeChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const setupTest = () => {
    return render(<Pagination {...defaultProps} />) as TestSetupResult;
  };

  const setupWithErrorBoundary = (props = defaultProps) => {
    return render(
      <TestErrorBoundary>
        <Pagination {...props} />
      </TestErrorBoundary>
    );
  };

  describe('edge cases', () => {
    it('handles zero total items', () => {
      render(<Pagination {...defaultProps} total={0} />);
      
      expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
      expect(screen.getByText('0 items')).toBeInTheDocument();
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });

    it('handles maximum page size limits', () => {
      render(<Pagination {...defaultProps} pageSize={1000000} />);
      const select = screen.getByLabelText('Items per page');
      
      // Should not show page sizes larger than available items
      const options = Array.from(select.getElementsByTagName('option'));
      const maxOption = Math.max(...options.map(opt => Number(opt.value)));
      expect(maxOption).toBeLessThanOrEqual(defaultProps.total);
    });

    it('adjusts current page when total items decrease', () => {
      const { rerender } = render(<Pagination {...defaultProps} currentPage={4} />);
      
      // Reduce total items so there are fewer pages
      rerender(<Pagination {...defaultProps} currentPage={4} total={20} />);
      
      expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
    });

    it('handles non-numeric inputs gracefully', () => {
      const { rerender } = render(<Pagination {...defaultProps} />);
      
      // Test invalid numeric props
      rerender(<Pagination 
        {...defaultProps}
        currentPage={NaN}
        pageSize={NaN}
        total={NaN}
      />);
      
      expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
      expect(screen.getByText('0 items')).toBeInTheDocument();
    });

    it('prevents navigation beyond boundaries', async () => {
      const { rerender } = render(<Pagination {...defaultProps} currentPage={0} />);
      
      const firstPageBtn = screen.getByRole('button', { name: 'First page' });
      const prevPageBtn = screen.getByRole('button', { name: 'Previous page' });
      
      expect(firstPageBtn).toBeDisabled();
      expect(prevPageBtn).toBeDisabled();
      
      const lastPageBtn = screen.getByRole('button', { name: 'Last page' });
      
      await act(async () => {
        userEvent.click(lastPageBtn);
        await Promise.resolve();
      });

      expect(defaultProps.onPageChange).toHaveBeenCalledWith(4);
      
      // Simulate the prop update that would happen in the parent
      rerender(<Pagination {...defaultProps} currentPage={4} />);
      
      // Next button should now be disabled since we're on the last page
      const nextButton = screen.getByRole('button', { name: 'Next page' });
      expect(nextButton).toBeDisabled();
    });

    it('maintains valid state during rapid prop changes', () => {
      const { rerender } = render(<Pagination {...defaultProps} />);
      
      // Simulate rapid prop changes
      const validPageSizes = [10, 20, 50, 100];
      for (let i = 0; i < 10; i++) {
        rerender(<Pagination 
          {...defaultProps}
          currentPage={i}
          pageSize={validPageSizes[i % validPageSizes.length]}
          total={100 - i}
        />);
      }
      
      // Should end up in a valid state
      expect(screen.getByRole('navigation')).toBeInTheDocument();
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    });
  });

  describe('accessibility requirements', () => {
    it('provides semantic structure with ARIA labels', () => {
      render(<Pagination {...defaultProps} />);
      
      expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', 'Pagination navigation');
      const combobox = screen.getByRole('combobox');
      expect(combobox).toHaveAttribute('aria-controls', 'pagination-items');
    });

    it('announces page changes to screen readers', () => {
      const { rerender } = render(<Pagination {...defaultProps} />);
      
      const pageStatus = screen.getByRole('status', { name: '' });
      expect(pageStatus).toHaveAttribute('aria-live', 'polite');
      
      rerender(<Pagination {...defaultProps} currentPage={1} />);
      expect(pageStatus).toHaveTextContent('Page 2 of 5');
    });

    it('manages keyboard focus correctly', () => {
      render(<Pagination {...defaultProps} />);
      
      const buttons = screen.getAllByRole('button');
      
      userEvent.tab();
      const combobox = screen.getByRole('combobox');
      expect(document.activeElement).toBe(combobox);
      
      userEvent.tab();
      const firstPageBtn = screen.getByRole('button', { name: 'First page' });
      expect(document.activeElement).toBe(firstPageBtn);
    });
  });

  describe('performance', () => {
    it('debounces rapid page changes', async () => {
      jest.useFakeTimers();
      
      render(<Pagination {...defaultProps} />);
      
      // Simulate rapid clicks
      const nextButton = screen.getByRole('button', { name: 'Next page' });
      await act(async () => {
        for (let i = 0; i < 5; i++) {
          userEvent.click(nextButton);
          // Allow any immediate effects to process
          await Promise.resolve();
        }
        // Run timers after all clicks
        jest.runAllTimers();
      });
      
      // Only last call should be processed after debounce
      expect(defaultProps.onPageChange).toHaveBeenCalledTimes(1);
      expect(defaultProps.onPageChange).toHaveBeenLastCalledWith(1);
      
      jest.useRealTimers();
    });
  });
});

describe('InfiniteScroll', () => {
  const mockItems: InfiniteScrollItem[] = Array.from({ length: 20 }, (_, i) => ({ 
    id: i, 
    name: `Item ${i}` 
  }));
  
  const defaultScrollProps: InfiniteScrollProps<InfiniteScrollItem> = {
    items: mockItems,
    hasMore: true,
    onLoadMore: jest.fn(),
    children: (items: InfiniteScrollItem[]) => (
      <div data-testid="items-container">
        {items.map(item => (
          <div key={item.id} role="article" data-testid="item">
            {item.name}
          </div>
        ))}
      </div>
    ),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const setupTest = () => {
    return render(<InfiniteScroll {...defaultScrollProps} />) as TestSetupResult;
  };

  const setupWithErrorBoundary = (props = defaultScrollProps) => {
    return render(
      <TestErrorBoundary>
        <InfiniteScroll {...props} />
      </TestErrorBoundary>
    );
  };

  describe('edge cases', () => {
    it('handles empty items array', () => {
      render(<InfiniteScroll {...defaultScrollProps} items={[]} />);
      
      expect(screen.queryByRole('article')).not.toBeInTheDocument();
      expect(screen.getByRole('feed')).toBeEmptyDOMElement();
    });

    it('handles null or undefined items', () => {
      const { rerender } = render(<InfiniteScroll {...defaultScrollProps} />);
      
      // @ts-ignore - Testing runtime behavior
      rerender(<InfiniteScroll {...defaultScrollProps} items={null} />);
      expect(screen.queryByRole('article')).not.toBeInTheDocument();
      
      // @ts-ignore - Testing runtime behavior
      rerender(<InfiniteScroll {...defaultScrollProps} items={undefined} />);
      expect(screen.queryByRole('article')).not.toBeInTheDocument();
    });

    it('prevents multiple simultaneous load more calls', async () => {
      render(<InfiniteScroll {...defaultScrollProps} loading={true} />);
      
      const scrollContainer = screen.getByRole('feed');
      Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1000 });
      Object.defineProperty(scrollContainer, 'clientHeight', { value: 500 });
      Object.defineProperty(scrollContainer, 'scrollTop', { value: 450 });

      // Multiple scroll events while loading
      fireEvent.scroll(scrollContainer);
      fireEvent.scroll(scrollContainer);
      fireEvent.scroll(scrollContainer);
      
      expect(defaultScrollProps.onLoadMore).not.toHaveBeenCalled();
    });

    it('handles invalid children prop types', () => {
      const invalidProps = {
        ...defaultScrollProps,
        children: jest.fn().mockReturnValue(null)
      };

      expect(() => render(<InfiniteScroll {...invalidProps} />)).not.toThrow();
    });

    it('respects minimum threshold value', () => {
      render(<InfiniteScroll {...defaultScrollProps} threshold={-100} />);
      
      const scrollContainer = screen.getByRole('feed');
      Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1000 });
      Object.defineProperty(scrollContainer, 'clientHeight', { value: 500 });
      Object.defineProperty(scrollContainer, 'scrollTop', { value: 450 });

      fireEvent.scroll(scrollContainer);
      expect(defaultScrollProps.onLoadMore).not.toHaveBeenCalled();
    });
  });

  describe('accessibility requirements', () => {
    it('provides semantic structure with ARIA labels', () => {
      render(<InfiniteScroll {...defaultScrollProps} />);
      
      const feed = screen.getByRole('feed');
      expect(feed).toHaveAttribute('aria-label', 'Infinite scroll content');
      
      const articles = screen.getAllByRole('article');
      articles.forEach(article => {
        expect(article).toHaveAttribute('aria-labelledby');
      });
    });

    it('announces loading state changes', () => {
      const { rerender } = render(<InfiniteScroll {...defaultScrollProps} />);
      
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');
      
      rerender(<InfiniteScroll {...defaultScrollProps} loading={true} />);
      expect(screen.getByRole('status')).toHaveTextContent('Loading more items...');
    });

    it('manages focus correctly during updates', () => {
      const { rerender } = render(<InfiniteScroll {...defaultScrollProps} />);
      
      const firstArticle = screen.getAllByRole('article')[0];
      firstArticle.focus();
      
      // Generate new items with unique IDs
      const additionalItems = mockItems.map(item => ({
        ...item,
        id: item.id + mockItems.length // offset IDs to make them unique
      }));
      
      rerender(<InfiniteScroll 
        {...defaultScrollProps} 
        items={[...mockItems, ...additionalItems]}
      />);
      
      expect(document.activeElement).toBe(firstArticle);
    });
  });
});
