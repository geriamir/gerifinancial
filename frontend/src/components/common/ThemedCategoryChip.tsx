import React from 'react';
import { Chip, ChipProps } from '@mui/material';
import type { SubCategory } from '../../services/api/types';
import CategoryIcon from './CategoryIcon';
import { getSubcategoryIconTheme } from '../../constants/categoryIconSystem';

interface ThemedCategoryChipProps extends Omit<ChipProps, 'label' | 'icon'> {
  subCategory: SubCategory;
  categoryName?: string;
  showIcon?: boolean;
  showBackground?: boolean;
  'data-testid'?: string;
}

/**
 * ThemedCategoryChip component - enhanced version of IconChip with PNG icons and theming
 */
const ThemedCategoryChip: React.FC<ThemedCategoryChipProps> = ({ 
  subCategory, 
  categoryName,
  showIcon = true,
  showBackground = false,
  ...props 
}) => {
  const theme = getSubcategoryIconTheme(subCategory.name, categoryName);

  return (
    <Chip
      {...props}
      label={
        <span data-testid="themed-chip-text">
          {subCategory.name}
        </span>
      }
      icon={showIcon ? (
        <CategoryIcon
          subcategoryName={subCategory.name}
          categoryName={categoryName}
          size="small"
          variant="plain"
          showTooltip={false}
          data-testid="themed-chip-icon"
        />
      ) : undefined}
      size="small"
      variant="outlined"
      sx={{
        borderColor: theme.border,
        backgroundColor: showBackground ? theme.background : 'transparent',
        color: theme.text,
        '&:hover': {
          backgroundColor: theme.background,
          borderColor: theme.primary,
        },
        '& .MuiChip-icon': {
          marginLeft: '8px',
          marginRight: '-4px',
        },
        ...props.sx,
      }}
    />
  );
};

export default ThemedCategoryChip;
