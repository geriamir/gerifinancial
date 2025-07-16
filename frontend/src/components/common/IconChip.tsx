import React from 'react';
import { ChipProps } from '@mui/material';
import type { SubCategory } from '../../services/api/types';
import ThemedCategoryChip from './ThemedCategoryChip';

interface IconChipProps extends Omit<ChipProps, 'label'> {
  subCategory: SubCategory;
  'data-testid'?: string;
}

/**
 * IconChip component - wrapper around ThemedCategoryChip for backward compatibility
 * @deprecated Use ThemedCategoryChip directly for new implementations
 */
const IconChip: React.FC<IconChipProps> = ({ 
  subCategory, 
  ...props 
}) => {
  return (
    <ThemedCategoryChip
      subCategory={subCategory}
      showIcon={true}
      showBackground={false}
      {...props}
    />
  );
};

export default IconChip;
