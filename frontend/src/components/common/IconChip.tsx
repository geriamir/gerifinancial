import React from 'react';
import { Chip, ChipProps } from '@mui/material';
import type { SubCategory } from '../../services/api/types';
import { getIconForSubcategory } from '../../constants/categoryIcons';

interface IconChipProps extends Omit<ChipProps, 'label'> {
  subCategory: SubCategory;
  'data-testid'?: string;
}

const IconChip: React.FC<IconChipProps> = ({ 
  subCategory, 
  ...props 
}) => {
  const iconMapping = getIconForSubcategory(subCategory.name);
  const Icon = iconMapping?.icon;

  return (
    <Chip
      {...props}
      label={
        <span data-testid="test-chip-text">
          {subCategory.name}
        </span>
      }
      icon={Icon && 
        <span 
          data-testid="test-chip-icon" 
          role="button" 
          aria-label={iconMapping.tooltip}
          className="MuiIconButton-root MuiIconButton-sizeSmall"
        >
          <Icon fontSize="small" />
        </span>
      }
      size="small"
      variant="outlined"
      color="secondary"
    />
  );
};

export default IconChip;
