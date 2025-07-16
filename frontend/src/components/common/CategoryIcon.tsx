import React, { useState, useCallback } from 'react';
import { Box, Tooltip } from '@mui/material';
import { getCategoryIconConfig, getSubcategoryIconConfig, CategoryIconConfig } from '../../constants/categoryIconSystem';
import { CategoryTheme } from '../../constants/categoryThemes';

/**
 * Size variants for the CategoryIcon
 */
type IconSize = 'small' | 'medium' | 'large' | 'xlarge';

/**
 * Visual style variants for the CategoryIcon
 */
type IconVariant = 'plain' | 'filled' | 'outlined' | 'rounded';

/**
 * Props for the CategoryIcon component
 */
interface CategoryIconProps {
  /** Category name to display icon for */
  categoryName?: string;
  /** Subcategory name to display icon for (takes precedence over categoryName) */
  subcategoryName?: string;
  /** Size of the icon */
  size?: IconSize;
  /** Visual variant of the icon */
  variant?: IconVariant;
  /** Whether to show background color */
  showBackground?: boolean;
  /** Whether to show tooltip on hover */
  showTooltip?: boolean;
  /** Custom tooltip text (overrides default) */
  tooltipText?: string;
  /** Additional CSS classes */
  className?: string;
  /** Click handler */
  onClick?: () => void;
  /** Whether the icon is in a selected state */
  selected?: boolean;
  /** Whether the icon is in a disabled state */
  disabled?: boolean;
  /** Custom theme override */
  customTheme?: CategoryTheme;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * Size mapping for different icon sizes
 */
const sizeMap: Record<IconSize, { width: number; height: number; padding: number }> = {
  small: { width: 20, height: 20, padding: 0 },
  medium: { width: 32, height: 32, padding: 8 },
  large: { width: 48, height: 48, padding: 12 },
  xlarge: { width: 64, height: 64, padding: 16 },
};

/**
 * CategoryIcon component - renders PNG icons with theming and fallback support
 */
const CategoryIcon: React.FC<CategoryIconProps> = ({
  categoryName,
  subcategoryName,
  size = 'medium',
  variant = 'plain',
  showBackground = false,
  showTooltip = true,
  tooltipText,
  className,
  onClick,
  selected = false,
  disabled = false,
  customTheme,
  'data-testid': dataTestId,
}) => {
  const [imageError, setImageError] = useState(false);

  // Get icon configuration
  const iconConfig: CategoryIconConfig = subcategoryName 
    ? getSubcategoryIconConfig(subcategoryName, categoryName)
    : getCategoryIconConfig(categoryName || 'Miscellaneous');

  // Use custom theme if provided, otherwise use theme from config
  const theme = customTheme || iconConfig.theme;
  const { width, height, padding } = sizeMap[size];

  // Handle image load success
  const handleImageLoad = useCallback(() => {
    setImageError(false);
  }, []);

  // Handle image load error
  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  // Generate styles based on variant and state
  const getContainerStyles = () => {
    const baseStyles = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: width + (padding * 2),
      height: height + (padding * 2),
      cursor: onClick ? 'pointer' : 'default',
      transition: 'all 0.2s ease-in-out',
      position: 'relative' as const,
      opacity: disabled ? 0.5 : 1,
      pointerEvents: disabled ? 'none' as const : 'auto',
    };

    // Add variant-specific styles
    switch (variant) {
      case 'filled':
        return {
          ...baseStyles,
          backgroundColor: selected ? theme.selected : (showBackground ? theme.background : 'transparent'),
          borderRadius: '8px',
          border: selected ? `2px solid ${theme.primary}` : 'none',
          '&:hover': onClick ? {
            backgroundColor: theme.hover,
            transform: 'scale(1.05)',
          } : {},
        };
      
      case 'outlined':
        return {
          ...baseStyles,
          border: `2px solid ${selected ? theme.primary : theme.border}`,
          borderRadius: '8px',
          backgroundColor: selected ? theme.selected : 'transparent',
          '&:hover': onClick ? {
            borderColor: theme.primary,
            backgroundColor: theme.background,
          } : {},
        };
      
      case 'rounded':
        return {
          ...baseStyles,
          backgroundColor: selected ? theme.selected : (showBackground ? theme.background : 'transparent'),
          borderRadius: '50%',
          border: selected ? `2px solid ${theme.primary}` : 'none',
          '&:hover': onClick ? {
            backgroundColor: theme.hover,
            transform: 'scale(1.1)',
          } : {},
        };
      
      default: // plain
        return {
          ...baseStyles,
          backgroundColor: 'transparent',
          '&:hover': onClick ? {
            opacity: 0.8,
            transform: 'scale(1.05)',
          } : {},
        };
    }
  };

  // Generate tooltip text
  const getTooltipText = () => {
    if (tooltipText) return tooltipText;
    return subcategoryName || categoryName || 'Category';
  };

  // Render the icon content
  const renderIconContent = () => {
    if (imageError) {
      // Fallback to a simple colored square with first letter
      const fallbackText = (subcategoryName || categoryName || 'M')[0].toUpperCase();
      return (
        <Box
          sx={{
            width,
            height,
            backgroundColor: theme.primary,
            color: theme.contrastText,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
            fontSize: Math.min(width, height) * 0.5,
            fontWeight: 600,
          }}
          data-testid={`${dataTestId}-fallback`}
        >
          {fallbackText}
        </Box>
      );
    }

    return (
      <img
        src={iconConfig.iconPath}
        alt={getTooltipText()}
        width={width}
        height={height}
        onLoad={handleImageLoad}
        onError={handleImageError}
        style={{
          objectFit: 'contain',
          borderRadius: '4px',
          display: 'block',
        }}
        data-testid={`${dataTestId}-image`}
      />
    );
  };

  // Main icon component
  const iconComponent = (
    <Box
      sx={getContainerStyles()}
      onClick={onClick}
      className={className}
      data-testid={dataTestId}
    >
      {renderIconContent()}
      
      {/* Selection indicator */}
      {selected && variant !== 'outlined' && (
        <Box
          sx={{
            position: 'absolute',
            top: -2,
            right: -2,
            width: 12,
            height: 12,
            backgroundColor: theme.primary,
            borderRadius: '50%',
            border: '2px solid white',
            zIndex: 1,
          }}
          data-testid={`${dataTestId}-selection-indicator`}
        />
      )}
    </Box>
  );

  // Wrap with tooltip if enabled
  if (showTooltip) {
    return (
      <Tooltip title={getTooltipText()} placement="top" arrow>
        {iconComponent}
      </Tooltip>
    );
  }

  return iconComponent;
};

export default CategoryIcon;
