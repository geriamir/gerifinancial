import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Collapse,
  ListItemButton
} from '@mui/material';
import {
  ExpandLess,
  ExpandMore
} from '@mui/icons-material';
import { formatCurrencyDisplay } from '../../utils/formatters';
import { getCategoryIconTheme } from '../../constants/categoryIconSystem';
import CategoryIcon from '../common/CategoryIcon';

interface Subcategory {
  name: string;
  budgeted: number;
  actual: number;
  categoryId?: string;
  subCategoryId?: string;
}

interface BudgetCategoryItemProps {
  category: string;
  subcategories: Subcategory[];
  totalBudgeted: number;
  totalActual: number;
  color: string;
  year: number;
  month: number;
  categoryId?: string;
  isIncomeCategory?: boolean;
}

const BudgetCategoryItem: React.FC<BudgetCategoryItemProps> = ({
  category,
  subcategories,
  totalBudgeted,
  totalActual,
  color,
  year,
  month,
  categoryId,
  isIncomeCategory
}) => {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  const handleToggle = () => {
    // For income categories, navigate to detail view instead of expanding
    if (isIncomeCategory && categoryId) {
      navigate(`/budgets/income/${year}/${month}/${categoryId}`);
      return;
    }
    
    // For expense categories with subcategories, expand/collapse
    setExpanded(!expanded);
  };

  const handleSubcategoryClick = (subcategory: Subcategory, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent expanding/collapsing the category
    if (subcategory.categoryId && subcategory.subCategoryId) {
      navigate(`/budgets/subcategory/${year}/${month}/${subcategory.categoryId}/${subcategory.subCategoryId}`);
    }
  };

  // Get category theme for consistent styling
  const categoryTheme = getCategoryIconTheme(category);

  return (
    <Box>
      <ListItemButton 
        onClick={handleToggle} 
        sx={{ 
          border: 1, 
          borderColor: 'grey.200', 
          borderRadius: 1, 
          mb: 1, 
          p: 2 
        }}
      >
        <Box display="flex" alignItems="center" gap={2} width="100%">
          {/* Category Icon */}
          <CategoryIcon 
            categoryName={category}
            size="small"
            variant="plain"
            showTooltip={false}
          />
          
          {/* Category Name and Budget/Actual */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography 
              variant="caption" 
              sx={{ 
                mb: 0.25, 
                display: 'block', 
                fontSize: '0.75rem', 
                lineHeight: 1.2, 
                fontWeight: 'bold',
                color: categoryTheme?.primary || `${color}.main`
              }}
            >
              {category}
            </Typography>
            <Typography 
              variant="body2" 
              color={color === 'error' && totalActual > totalBudgeted ? 'error.main' : 'text.secondary'}
            >
              {formatCurrencyDisplay(totalActual)}/{formatCurrencyDisplay(totalBudgeted)}
            </Typography>
          </Box>
          
          {/* Collapse Button */}
          {subcategories.length > 0 && (
            <Box sx={{ ml: 'auto' }}>
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </Box>
          )}
        </Box>
      </ListItemButton>
      
      {subcategories.length > 0 && (
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Box ml={4}>
            {subcategories.map((sub, index) => (
              <Box 
                key={index} 
                p={2} 
                mb={0.5} 
                border={1} 
                borderColor="grey.100" 
                borderRadius={1} 
                bgcolor="grey.50"
                sx={{ 
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: 'grey.100'
                  }
                }}
                onClick={(e) => handleSubcategoryClick(sub, e)}
              >
                <Box display="flex" alignItems="center" gap={2} width="100%">
                  {/* Subcategory Name and Budget/Actual */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        mb: 0.25, 
                        display: 'block', 
                        fontSize: '0.75rem', 
                        lineHeight: 1.2, 
                        fontWeight: 'bold'
                      }}
                    >
                      {sub.name}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color={color === 'error' && sub.actual > sub.budgeted ? 'error.main' : 'text.secondary'}
                    >
                      {formatCurrencyDisplay(sub.actual)}/{formatCurrencyDisplay(sub.budgeted)}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        </Collapse>
      )}
    </Box>
  );
};

export default BudgetCategoryItem;
