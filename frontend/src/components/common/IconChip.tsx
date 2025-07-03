/**
 * IconChip Component
 * 
 * A component that displays a subcategory either as an icon (if mapped in categoryIcons)
 * or as a text chip (fallback for unmapped/custom categories). The icon version includes
 * a tooltip showing the full subcategory name.
 * 
 * Features:
 * - Automatic icon mapping based on subcategory name
 * - Tooltip support for icon display
 * - Fallback to text display for unmapped categories
 * - Consistent styling with Material-UI components
 * - Full accessibility support through ARIA attributes
 * 
 * @component
 * @example
 * ```tsx
 * import IconChip from '../common/IconChip';
 * 
 * const MyComponent = () => {
 *   const subCategory = {
 *     _id: '123',
 *     name: 'Mortgage',
 *     parentCategory: { _id: '456', name: 'Housing', type: 'expense' },
 *     keywords: ['mortgage', 'loan'],
 *     isDefault: true
 *   };
 * 
 *   return <IconChip subCategory={subCategory} />;
 * };
 * ```
 */

import React from 'react';
import { Tooltip, IconButton, Box, Typography } from '@mui/material';
import { SubCategory } from '../../services/api/types';
import { getIconForSubcategory } from '../../constants/categoryIcons';

/**
 * Props for the IconChip component
 */
interface IconChipProps {
  /** The subcategory to display */
  subCategory: SubCategory;
  /** Optional test ID for testing purposes */
  'data-testid'?: string;
}

const IconChip: React.FC<IconChipProps> = ({ subCategory, 'data-testid': testId }) => {
  const baseTestId = testId || `subcategory-${subCategory._id}`;
  const iconMapping = getIconForSubcategory(subCategory.name);

  if (!iconMapping) {
    // Fallback to text display if no icon mapping exists
    return (
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          px: 1,
          py: 0.5,
          borderRadius: 1,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
        }}
        data-testid={`${baseTestId}-text`}
      >
        <Typography variant="body2" color="text.secondary">
          {subCategory.name}
        </Typography>
      </Box>
    );
  }

  const Icon = iconMapping.icon;

  return (
    <Tooltip title={iconMapping.tooltip} data-testid={`${baseTestId}-tooltip`}>
      <IconButton
        size="small"
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          p: 0.5,
        }}
        data-testid={`${baseTestId}-icon`}
      >
        <Icon fontSize="small" color="action" />
      </IconButton>
    </Tooltip>
  );
};

export default IconChip;
