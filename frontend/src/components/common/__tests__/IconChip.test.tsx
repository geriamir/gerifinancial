import React from 'react';
import { render, screen } from '@testing-library/react';
import IconChip from '../IconChip';
import type { SubCategory } from '../../../services/api/types';
import { Home } from '@mui/icons-material';
import * as categoryIconsModule from '../../../constants/categoryIcons';

// Mock the getIconForSubcategory function
jest.mock('../../../constants/categoryIcons', () => ({
  getIconForSubcategory: jest.fn()
}));

const { getIconForSubcategory } = categoryIconsModule;

describe('IconChip', () => {
  const mockSubCategory: SubCategory = {
    _id: '123',
    name: 'Mortgage',
    parentCategory: 'cat1',
    userId: 'user1',
    keywords: ['mortgage', 'loan'],
    isDefault: true,
    createdAt: '2025-07-09T10:00:00Z',
    updatedAt: '2025-07-09T10:00:00Z'
  };

  const mockCustomSubCategory: SubCategory = {
    _id: '789',
    name: 'Custom Category',
    parentCategory: 'cat1',
    userId: 'user1',
    keywords: [],
    isDefault: false,
    createdAt: '2025-07-09T10:00:00Z',
    updatedAt: '2025-07-09T10:00:00Z'
  };

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    // Default mock implementation
    (getIconForSubcategory as jest.Mock).mockReturnValue({
      icon: Home,
      tooltip: 'Mortgage'
    });
  });

  it('renders with basic content', () => {
    render(<IconChip subCategory={mockSubCategory} data-testid="test-chip" />);
    
    const chip = screen.getByTestId('test-chip-text');
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveTextContent('Mortgage');
  });

  it('renders with icon for mapped subcategory', () => {
    render(<IconChip subCategory={mockSubCategory} data-testid="test-chip" />);

    const icon = screen.getByTestId('test-chip-icon');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute('role', 'button');
    expect(icon).toHaveAttribute('aria-label', 'Mortgage');
  });

  it('renders text only for unmapped subcategory', () => {
    // Mock no icon mapping found
    (getIconForSubcategory as jest.Mock).mockReturnValueOnce(null);

    render(<IconChip subCategory={mockCustomSubCategory} data-testid="test-chip" />);

    // Check that only text is rendered
    expect(screen.getByTestId('test-chip-text')).toHaveTextContent('Custom Category');
    expect(screen.queryByTestId('test-chip-icon')).not.toBeInTheDocument();
  });

  it('handles special characters in subcategory name', () => {
    const specialCharSubCategory: SubCategory = {
      _id: '101',
      name: 'Special & Category',
      parentCategory: 'cat1',
      userId: 'user1',
      keywords: [],
      isDefault: false,
      createdAt: '2025-07-09T10:00:00Z',
      updatedAt: '2025-07-09T10:00:00Z'
    };

    render(<IconChip subCategory={specialCharSubCategory} data-testid="test-chip" />);
    expect(screen.getByTestId('test-chip-text')).toHaveTextContent('Special & Category');
  });

  it('applies proper styling', () => {
    render(<IconChip subCategory={mockSubCategory} data-testid="test-chip" />);

    const iconContainer = screen.getByTestId('test-chip-icon');
    expect(iconContainer).toHaveClass('MuiIconButton-root', 'MuiIconButton-sizeSmall');
  });
});
