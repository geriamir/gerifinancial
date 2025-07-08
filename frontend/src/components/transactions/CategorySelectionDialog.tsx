import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Chip,
  Typography,
  Box,
  Autocomplete,
  IconButton,
  Tooltip,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  Category as CategoryIcon,
  ArrowRight as ArrowRightIcon,
  Star as StarIcon
} from '@mui/icons-material';
import { useCategories } from '../../hooks/useCategories';
import type { Category, SubCategory } from '../../services/api/types/categories';
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut';

interface CategorySelectionDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (category: Category, subCategory?: SubCategory) => void;
  currentCategory?: Category;
  currentSubCategory?: SubCategory;
  suggestedCategory?: Category;
  aiConfidence?: number;
  description?: string;
}

export const CategorySelectionDialog: React.FC<CategorySelectionDialogProps> = ({
  open,
  onClose,
  onSelect,
  currentCategory,
  currentSubCategory,
  suggestedCategory,
  aiConfidence,
  description
}) => {
  const { categories, loading, error } = useCategories();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(currentCategory || null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<SubCategory | null>(currentSubCategory || null);

  // Reset selection when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSelectedCategory(currentCategory || null);
      setSelectedSubCategory(currentSubCategory || null);
      setSearchTerm('');
    }
  }, [open, currentCategory, currentSubCategory]);

  // Keyboard shortcuts
  useKeyboardShortcut({ key: 'Escape' }, onClose);
  useKeyboardShortcut({ key: 'Enter' }, () => {
    if (selectedCategory) {
      handleConfirm();
    }
  });

  const handleConfirm = () => {
    if (selectedCategory) {
      onSelect(selectedCategory, selectedSubCategory || undefined);
      onClose();
    }
  };

  const handleCategorySelect = (category: Category) => {
    setSelectedCategory(category);
    setSelectedSubCategory(null);
  };

  const handleSubCategorySelect = (subCategory: SubCategory) => {
    setSelectedSubCategory(subCategory);
  };

  // Filter categories based on search term
  const filteredCategories = categories.filter(category => 
    category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    category.subCategories?.some(sub => 
      sub.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // Group categories by type
  const groupedCategories = {
    Expense: filteredCategories.filter(c => c.type === 'Expense'),
    Income: filteredCategories.filter(c => c.type === 'Income'),
    Transfer: filteredCategories.filter(c => c.type === 'Transfer')
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="category-selection-dialog"
    >
      <DialogTitle id="category-selection-dialog">
        Select Category
        {description && (
          <Typography variant="subtitle2" color="textSecondary">
            For: {description}
          </Typography>
        )}
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            label="Search categories"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            variant="outlined"
            size="small"
            autoFocus
          />
        </Box>

        {suggestedCategory && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              AI Suggestion
            </Typography>
            <Chip
              icon={<StarIcon />}
              label={`${suggestedCategory.name} (${Math.round(aiConfidence || 0)}% confidence)`}
              color="primary"
              variant={selectedCategory?.name === suggestedCategory.name ? 'filled' : 'outlined'}
              onClick={() => handleCategorySelect(suggestedCategory)}
              sx={{ mr: 1 }}
            />
          </Box>
        )}

        {loading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Typography color="error">Failed to load categories</Typography>
        ) : (
          <Box display="flex">
            {/* Categories List */}
            <Box flex={1} mr={2}>
              {Object.entries(groupedCategories).map(([type, cats]) => (
                <React.Fragment key={type}>
                  <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                    {type}
                  </Typography>
                  <List dense>
                    {cats.map((category) => (
                      <ListItem key={category._id} disablePadding>
                        <ListItemButton
                          selected={selectedCategory?._id === category._id}
                          onClick={() => handleCategorySelect(category)}
                        >
                          <ListItemIcon>
                            <CategoryIcon 
                              sx={{ color: category.color || 'inherit' }}
                            />
                          </ListItemIcon>
                          <ListItemText primary={category.name} />
                          {category.subCategories && category.subCategories.length > 0 && (
                            <ArrowRightIcon />
                          )}
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                  <Divider />
                </React.Fragment>
              ))}
            </Box>

            {/* Subcategories List */}
            {selectedCategory && selectedCategory.subCategories && (
              <Box flex={1}>
                <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                  Subcategories
                </Typography>
                <List dense>
                  {selectedCategory.subCategories.map((subCategory) => (
                    <ListItem key={subCategory._id} disablePadding>
                      <ListItemButton
                        selected={selectedSubCategory?._id === subCategory._id}
                        onClick={() => handleSubCategorySelect(subCategory)}
                      >
                        <ListItemText primary={subCategory.name} />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleConfirm}
          color="primary"
          disabled={!selectedCategory}
        >
          Select
        </Button>
      </DialogActions>
    </Dialog>
  );
};
