import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Autocomplete
} from '@mui/material';
import { getCurrencySymbol, formatCurrency } from '../../types/foreignCurrency';
import { CategoryBudget } from '../../types/projects';

interface AddPlannedExpenseDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (expense: Partial<CategoryBudget>) => void;
  availableCategories: Array<{
    _id: string;
    name: string;
    type: 'Income' | 'Expense' | 'Transfer';
    subCategories: Array<{
      _id: string;
      name: string;
      keywords: string[];
    }>;
  }>;
  projectCurrency: string;
  projectType?: string;
  editingExpense?: {
    index: number;
    categoryId: string;
    subCategoryId: string;
    budgetedAmount: number;
    description?: string;
    currency?: string;
  } | null;
  onEdit?: (index: number, updates: Partial<CategoryBudget>) => void;
}

const AddPlannedExpenseDialog: React.FC<AddPlannedExpenseDialogProps> = ({
  open,
  onClose,
  onAdd,
  availableCategories,
  projectCurrency,
  projectType,
  editingExpense,
  onEdit
}) => {
  const isEditing = !!editingExpense;
  // For vacation projects, find Travel/Vacation category and pre-select it
  const expenseCategories = availableCategories.filter(cat => cat.type === 'Expense');
  const isVacationProject = projectType === 'vacation';
  
  // Find travel/vacation category for vacation projects
  const travelCategory = expenseCategories.find(cat => 
    cat.name.toLowerCase().includes('travel') || 
    cat.name.toLowerCase().includes('vacation') ||
    cat.name.toLowerCase().includes('trip')
  );

  const getDefaultFormData = (): Partial<CategoryBudget> => {
    if (editingExpense) {
      return {
        categoryId: editingExpense.categoryId,
        subCategoryId: editingExpense.subCategoryId,
        budgetedAmount: editingExpense.budgetedAmount,
        actualAmount: 0,
        description: editingExpense.description || '',
        currency: editingExpense.currency || projectCurrency
      };
    }
    return {
      categoryId: isVacationProject && travelCategory ? travelCategory._id : '',
      subCategoryId: undefined,
      budgetedAmount: 0,
      actualAmount: 0,
      description: '',
      currency: projectCurrency
    };
  };

  const [formData, setFormData] = useState<Partial<CategoryBudget>>(getDefaultFormData());
  
  // Update form when editingExpense changes
  useEffect(() => {
    if (open) {
      setFormData(getDefaultFormData());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingExpense]);
  
  // Ref for description input to handle focus
  const descriptionInputRef = useRef<HTMLInputElement>(null);
  
  // Focus description input when dialog opens
  useEffect(() => {
    if (open) {
      // Use a timeout to ensure Material-UI dialog is fully rendered
      const timer = setTimeout(() => {
        if (descriptionInputRef.current) {
          descriptionInputRef.current.focus();
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [open]);
  
  // Get selected category to show its subcategories
  const selectedCategory = expenseCategories.find(cat => cat._id === formData.categoryId);

  const handleSubmit = () => {
    if (!formData.categoryId) {
      return;
    }

    const cleanedData: Partial<CategoryBudget> = {
      categoryId: formData.categoryId,
      subCategoryId: formData.subCategoryId || '',
      budgetedAmount: formData.budgetedAmount || 0,
      description: formData.description,
      currency: formData.currency || projectCurrency
    };

    if (isEditing && onEdit && editingExpense) {
      onEdit(editingExpense.index, cleanedData);
    } else {
      onAdd(cleanedData);
    }
    handleClose();
  };

  const handleClose = () => {
    setFormData(getDefaultFormData());
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="sm" 
      fullWidth
    >
      <DialogTitle>{isEditing ? 'Edit Planned Expense' : 'Add Planned Expense'}</DialogTitle>
      <DialogContent>
        <Box 
          component="form" 
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          display="flex" 
          flexDirection="column" 
          gap={2} 
          mt={2}
        >
          {/* Description */}
          <TextField
            fullWidth
            label="Description"
            value={formData.description || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Enter expense description..."
            inputRef={descriptionInputRef}
          />

          {/* Category Selection - Hidden for vacation projects */}
          {!isVacationProject && (
            <FormControl fullWidth required>
              <InputLabel>Category</InputLabel>
              <Select
                value={formData.categoryId || ''}
                onChange={(e) => {
                  const categoryId = e.target.value;
                  const category = expenseCategories.find(cat => cat._id === categoryId);
                  
                  setFormData(prev => ({
                    ...prev,
                    categoryId,
                    // Reset subcategory when category changes
                    subCategoryId: category?.subCategories?.[0]?._id || undefined
                  }));
                }}
                label="Category"
              >
                {expenseCategories.map(category => (
                  <MenuItem key={category._id} value={category._id}>
                    {category.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Subcategory Selection with Autocomplete */}
          {selectedCategory && selectedCategory.subCategories && selectedCategory.subCategories.length > 0 && (
            <Autocomplete
              fullWidth
              options={[
                { _id: '', name: 'No subcategory' },
                ...selectedCategory.subCategories
              ]}
              getOptionLabel={(option) => option.name}
              value={selectedCategory.subCategories.find(sub => sub._id === formData.subCategoryId) || { _id: '', name: 'No subcategory' }}
              onChange={(event, newValue) => {
                setFormData(prev => ({
                  ...prev,
                  subCategoryId: newValue?._id || undefined
                }));
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Subcategory"
                  placeholder="Search or select subcategory..."
                />
              )}
              renderOption={(props, option) => {
                const { key, ...otherProps } = props;
                return (
                  <Box component="li" key={key} {...otherProps}>
                    {option._id === '' ? (
                      <em>{option.name}</em>
                    ) : (
                      option.name
                    )}
                  </Box>
                );
              }}
              isOptionEqualToValue={(option, value) => option._id === value._id}
              clearOnBlur
              clearOnEscape
              autoHighlight
            />
          )}

          {/* Currency Selection */}
          <FormControl fullWidth>
            <InputLabel>Currency</InputLabel>
            <Select
              value={formData.currency || projectCurrency}
              onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
              label="Currency"
            >
              <MenuItem value="ILS">ILS (₪)</MenuItem>
              <MenuItem value="USD">USD ($)</MenuItem>
              <MenuItem value="EUR">EUR (€)</MenuItem>
              <MenuItem value="GBP">GBP (£)</MenuItem>
            </Select>
          </FormControl>

          {/* Budget Amount */}
          <TextField
            fullWidth
            label="Budgeted Amount"
            type="number"
            value={formData.budgetedAmount || ''}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              budgetedAmount: Number(e.target.value) || 0
            }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
              }
            }}
            InputProps={{
              startAdornment: <Typography sx={{ mr: 1 }}>{getCurrencySymbol(formData.currency || projectCurrency)}</Typography>,
              inputProps: { min: 0, step: 10 }
            }}
          />

          {/* Preview */}
          {formData.categoryId && (
            <Box mt={2} p={2} bgcolor="action.hover" borderRadius={1}>
              <Typography variant="body2" color="text.secondary">
                Preview:
              </Typography>
              <Typography variant="body1">
                <strong>{formData.description}</strong> in{' '}
                <strong>{selectedCategory?.name}</strong>
                {formData.subCategoryId && selectedCategory?.subCategories?.find(sub => sub._id === formData.subCategoryId) && (
                  <> → <strong>{selectedCategory.subCategories.find(sub => sub._id === formData.subCategoryId)?.name}</strong></>
                )}
              </Typography>
              <Typography variant="body2" color="primary.main">
                Budget: {formatCurrency(formData.budgetedAmount || 0, formData.currency || projectCurrency)}
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained"
          disabled={!formData.categoryId}
        >
          {isEditing ? 'Save' : 'Add Expense'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddPlannedExpenseDialog;
