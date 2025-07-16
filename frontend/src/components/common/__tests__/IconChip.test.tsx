import React from 'react';
import { render, screen } from '@testing-library/react';
import IconChip from '../IconChip';
import type { SubCategory } from '../../../services/api/types';

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

  it('renders with basic content', () => {
    render(<IconChip subCategory={mockSubCategory} data-testid="test-chip" />);
    
    const chip = screen.getByTestId('themed-chip-text');
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveTextContent('Mortgage');
  });

  it('renders with icon for mapped subcategory', () => {
    render(<IconChip subCategory={mockSubCategory} data-testid="test-chip" />);

    const icon = screen.getByTestId('themed-chip-icon');
    expect(icon).toBeInTheDocument();
    // The icon should have an image inside it
    const image = screen.getByTestId('themed-chip-icon-image');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('alt', 'Mortgage');
  });

  it('renders text only for unmapped subcategory', () => {
    render(<IconChip subCategory={mockCustomSubCategory} data-testid="test-chip" />);

    // Check that text is rendered
    expect(screen.getByTestId('themed-chip-text')).toHaveTextContent('Custom Category');
    // Icon should still be present (fallback system)
    expect(screen.getByTestId('themed-chip-icon')).toBeInTheDocument();
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
    expect(screen.getByTestId('themed-chip-text')).toHaveTextContent('Special & Category');
  });

  it('applies proper styling', () => {
    render(<IconChip subCategory={mockSubCategory} data-testid="test-chip" />);

    const chip = screen.getByTestId('test-chip');
    expect(chip).toHaveClass('MuiChip-root');
    
    const iconContainer = screen.getByTestId('themed-chip-icon');
    expect(iconContainer).toBeInTheDocument();
  });
});
