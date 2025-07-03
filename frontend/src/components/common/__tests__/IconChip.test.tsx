import React from 'react';
import { render, screen, within } from '@testing-library/react';
import IconChip from '../IconChip';
import { SubCategory } from '../../../services/api/types';
import { Home } from '@mui/icons-material';
import { categoryIcons } from '../../../constants/categoryIcons';

describe('IconChip', () => {
  const mockSubCategory: SubCategory = {
    _id: '123',
    name: 'Mortgage',
    parentCategory: {
      _id: '456',
      name: 'Household',
      type: 'expense'
    },
    keywords: ['mortgage', 'loan'],
    isDefault: true
  };

  const mockCustomSubCategory: SubCategory = {
    _id: '789',
    name: 'Custom Category',
    parentCategory: {
      _id: '456',
      name: 'Household',
      type: 'expense'
    },
    keywords: [],
    isDefault: false
  };

  it('renders icon for mapped subcategory', () => {
    render(<IconChip subCategory={mockSubCategory} data-testid="test-chip" />);
    
    // Check that the icon button is rendered
    const iconButton = screen.getByTestId('test-chip-icon');
    expect(iconButton).toBeInTheDocument();
    
    // Check that the button has correct tooltip text
    expect(iconButton).toHaveAttribute('aria-label', 'Mortgage');
  });

  it('renders text fallback for unmapped subcategory', () => {
    render(<IconChip subCategory={mockCustomSubCategory} data-testid="test-chip" />);
    
    // Check that the text fallback is rendered
    const textFallback = screen.getByTestId('test-chip-text');
    expect(textFallback).toBeInTheDocument();
    expect(textFallback).toHaveTextContent('Custom Category');
    
    // Check that the icon button is not rendered
    const iconButton = screen.queryByTestId('test-chip-icon');
    expect(iconButton).not.toBeInTheDocument();
  });

  it('applies correct styling to icon button', () => {
    render(<IconChip subCategory={mockSubCategory} data-testid="test-chip" />);
    
    const iconButton = screen.getByTestId('test-chip-icon');
    
    // Check that the button has the correct styling classes
    expect(iconButton).toHaveClass('MuiIconButton-root');
    expect(iconButton).toHaveClass('MuiIconButton-sizeSmall');
    
    // Verify icon presence
    const icon = within(iconButton).getByTestId('HomeIcon');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass('MuiSvgIcon-fontSizeSmall');
    expect(icon).toHaveClass('MuiSvgIcon-colorAction');
  });

  it('applies correct styling to text fallback', () => {
    render(<IconChip subCategory={mockCustomSubCategory} data-testid="test-chip" />);
    
    const textFallback = screen.getByTestId('test-chip-text');
    
    // Check that the text fallback has the correct styling classes
    expect(textFallback).toHaveClass('MuiBox-root');
    const textElement = within(textFallback).getByText('Custom Category');
    expect(textElement).toHaveClass('MuiTypography-root');
    expect(textElement).toHaveClass('MuiTypography-body2');
  });

  it('handles subcategories with special characters in name', () => {
    const specialCharSubCategory: SubCategory = {
      _id: '101',
      name: 'Special & Category',
      parentCategory: {
        _id: '456',
        name: 'Household',
        type: 'expense'
      },
      keywords: [],
      isDefault: false
    };

    render(<IconChip subCategory={specialCharSubCategory} data-testid="test-chip" />);
    
    const textFallback = screen.getByTestId('test-chip-text');
    expect(textFallback).toHaveTextContent('Special & Category');
  });
});
