import React from 'react';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { Pagination, InfiniteScroll } from '../Pagination';

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

      const options = Array.from(select.getElementsByTagName('option'));
      const maxOption = Math.max(...options.map(opt => Number(opt.value)));
      expect(maxOption).toBeLessThanOrEqual(defaultProps.total);
    });

    it('adjusts current page when total items decrease', () => {
      const { rerender } = render(<Pagination {...defaultProps} currentPage={4} />);
      rerender(<Pagination {...defaultProps} currentPage={4} total={20} />);
      expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
    });

    it('handles non-numeric inputs gracefully', () => {
      const { rerender } = render(<Pagination {...defaultProps} />);

      rerender(<Pagination
        {...defaultProps}
        currentPage={NaN}
        pageSize={NaN}
        total={NaN}
      />);

      expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
      expect(screen.getByText('0 items')).toBeInTheDocument();
    });
  });

  describe('accessibility requirements', () => {
    it('provides semantic structure with ARIA labels', () => {
      render(<Pagination {...defaultProps} />);

      const navigation = screen.getByRole('navigation');
      expect(navigation).toHaveAttribute('aria-label', 'Pagination navigation');

      const itemsPerPage = screen.getByLabelText('Items per page');
      expect(itemsPerPage).toBeInTheDocument();
      
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');
    });

    it('announces page changes to screen readers', async () => {
      const { rerender } = render(<Pagination {...defaultProps} />);

      const status = screen.getByRole('status');
      expect(status).toHaveTextContent('Page 1 of 5');

      rerender(<Pagination {...defaultProps} currentPage={1} />);
      expect(status).toHaveTextContent('Page 2 of 5');
    });

    it('manages keyboard navigation', async () => {
      render(<Pagination {...defaultProps} />);
      const navigation = screen.getByRole('navigation');

      // Focus the navigation
      navigation.focus();

      // Right arrow should go to next page
      fireEvent.keyDown(navigation, { key: 'ArrowRight' });
      expect(defaultProps.onPageChange).toHaveBeenCalledWith(1);

      // Left arrow should go to previous page (but we're on first page)
      fireEvent.keyDown(navigation, { key: 'ArrowLeft' });
      expect(defaultProps.onPageChange).toHaveBeenCalledTimes(1);

      // Home should not trigger on first page
      fireEvent.keyDown(navigation, { key: 'Home' });
      expect(defaultProps.onPageChange).toHaveBeenCalledTimes(1);

      // End should go to last page
      fireEvent.keyDown(navigation, { key: 'End' });
      expect(defaultProps.onPageChange).toHaveBeenCalledWith(4);
    });
  });

  describe('performance', () => {
    it('handles rapid page changes', async () => {
      render(<Pagination {...defaultProps} />);

      const nextButton = screen.getByRole('button', { name: 'Next page' });
      await act(async () => {
        for (let i = 0; i < 5; i++) {
          fireEvent.click(nextButton);
        }
      });

      // Should call with the last page change
      expect(defaultProps.onPageChange).toHaveBeenCalledWith(1);
    });
  });
});

describe('InfiniteScroll', () => {
  const mockItems: InfiniteScrollItem[] = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    name: `Item ${i}`
  }));

  const defaultScrollProps = {
    items: mockItems,
    hasMore: true,
    onLoadMore: jest.fn(),
    children: (items: InfiniteScrollItem[]) => (
      <div data-testid="items-container">
        {items?.map(item => (
          <div key={item.id} role="article" data-testid="item">
            {item.name}
          </div>
        )) || null}
      </div>
    ),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('edge cases', () => {
    it('handles empty items array', () => {
      const { container } = render(<InfiniteScroll {...defaultScrollProps} items={[]} />);
      expect(screen.queryByRole('article')).not.toBeInTheDocument();
      expect(container.querySelector('[role="feed"]')).toBeInTheDocument();
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

    it('prevents multiple simultaneous load more calls', () => {
      render(<InfiniteScroll {...defaultScrollProps} loading={true} />);

      const scrollContainer = screen.getByRole('feed');
      Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1000 });
      Object.defineProperty(scrollContainer, 'clientHeight', { value: 500 });
      Object.defineProperty(scrollContainer, 'scrollTop', { value: 450 });

      fireEvent.scroll(scrollContainer);
      fireEvent.scroll(scrollContainer);
      fireEvent.scroll(scrollContainer);

      expect(defaultScrollProps.onLoadMore).not.toHaveBeenCalled();
    });
  });

  describe('accessibility requirements', () => {
    it('provides semantic structure', () => {
      render(<InfiniteScroll {...defaultScrollProps} />);

      const feed = screen.getByRole('feed');
      expect(feed).toHaveAttribute('aria-label', 'Infinite scroll content');
      expect(feed).toHaveAttribute('aria-busy', 'false');

      const articles = screen.getAllByRole('article');
      articles.forEach((article, index) => {
        expect(article).toHaveTextContent(`Item ${index}`);
      });
    });

    it('announces loading state changes', async () => {
      const { rerender } = render(<InfiniteScroll {...defaultScrollProps} />);

      rerender(<InfiniteScroll {...defaultScrollProps} loading={true} />);
      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent('Loading more items...');
        expect(screen.getByRole('feed')).toHaveAttribute('aria-busy', 'true');
      });
    });
  });
});
