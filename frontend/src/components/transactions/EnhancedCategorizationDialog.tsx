import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  Box,
  Card,
  CardActionArea,
  Button,
  CircularProgress,
  Backdrop,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import { ArrowBack, Close, ChevronLeft, ChevronRight } from '@mui/icons-material';
import { Transaction } from '../../services/api/types/transactions';
import { Category, SubCategory } from '../../services/api/types/categories';
import { formatCurrencyDisplay } from '../../utils/formatters';
import CategoryIcon from '../common/CategoryIcon';
import { getCategoryIconTheme } from '../../constants/categoryIconSystem';
import ManualCategorizationDialog from './ManualCategorizationDialog';

interface EnhancedCategorizationDialogProps {
  open: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  categories: Category[];
  onCategorize: (categoryId: string, subCategoryId: string, saveAsManual?: boolean, matchingFields?: any) => Promise<void>;
  isLoading: boolean;
}

type Step = 'category' | 'subcategory';

type TransactionType = 'Expense' | 'Income' | 'Transfer';

interface TypeOption {
  type: TransactionType;
  label: string;
  description: string;
  color: string;
}

const typeOptions: TypeOption[] = [
  {
    type: 'Expense',
    label: 'Expense',
    description: 'Money going out',
    color: '#ef4444', // red-500
  },
  {
    type: 'Income',
    label: 'Income', 
    description: 'Money coming in',
    color: '#22c55e', // green-500
  },
  {
    type: 'Transfer',
    label: 'Transfer',
    description: 'Between accounts',
    color: '#3b82f6', // blue-500
  },
];

export const EnhancedCategorizationDialog: React.FC<EnhancedCategorizationDialogProps> = ({
  open,
  onClose,
  transaction,
  categories,
  onCategorize,
  isLoading,
}) => {
  const [currentStep, setCurrentStep] = useState<Step>('category');
  const [selectedType, setSelectedType] = useState<TransactionType>('Expense');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<SubCategory | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [showManualDialog, setShowManualDialog] = useState(false);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open && transaction) {
      // Pre-select type based on transaction amount
      const inferredType = transaction.amount < 0 ? 'Expense' : 'Income';
      setSelectedType(inferredType);
      setCurrentStep('category');
      setSelectedCategory(null);
      setCurrentPage(0);
    }
  }, [open, transaction]);

  // Reset page when type changes
  useEffect(() => {
    setCurrentPage(0);
  }, [selectedType]);

  // Filter categories by selected type
  const filteredCategories = categories.filter(cat => cat.type === selectedType);
  
  // Carousel pagination
  const ITEMS_PER_PAGE = 6;
  const totalPages = Math.ceil(filteredCategories.length / ITEMS_PER_PAGE);
  const startIndex = currentPage * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredCategories.length);
  const currentCategories = filteredCategories.slice(startIndex, endIndex);

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages - 1, prev + 1));
  };

  const handleCategorySelect = (category: Category) => {
    setSelectedCategory(category);
    setSelectedSubCategory(null);
    // Only proceed to subcategory step for Expense categories with subcategories
    if (category.type === 'Expense' && category.subCategories && category.subCategories.length > 0) {
      setCurrentStep('subcategory');
    } else {
      // Income/Transfer categories - show manual categorization dialog
      setShowManualDialog(true);
    }
  };

  const handleSubcategorySelect = (subcategory: SubCategory) => {
    if (selectedCategory) {
      setSelectedSubCategory(subcategory);
      setShowManualDialog(true);
    }
  };

  const handleManualCategorization = async (data: {
    saveAsManual: boolean;
    matchingFields: any;
  }) => {
    if (!selectedCategory) return;
    
    try {
      await onCategorize(
        selectedCategory._id, 
        selectedSubCategory?._id || '', 
        data.saveAsManual, 
        data.matchingFields
      );
      setShowManualDialog(false);
      onClose();
    } catch (error) {
      console.error('Failed to categorize transaction:', error);
    }
  };

  const handleBack = () => {
    if (currentStep === 'subcategory') {
      setCurrentStep('category');
      setSelectedCategory(null);
    }
  };

  if (!transaction) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: '90vh',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {currentStep === 'subcategory' && (
            <IconButton
              onClick={handleBack}
              size="small"
            >
              <ArrowBack />
            </IconButton>
          )}
          <Box>
            <DialogTitle sx={{ p: 0, fontSize: '1.125rem', fontWeight: 600 }}>
              {currentStep === 'category' && 'Choose Categorization'}
              {currentStep === 'subcategory' && 'Choose a sub category'}
            </DialogTitle>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {formatCurrencyDisplay(transaction.amount, transaction.currency)} • {transaction.description}
            </Typography>
          </Box>
        </Box>
        <IconButton
          onClick={onClose}
          size="small"
        >
          <Close />
        </IconButton>
      </Box>

      <DialogContent sx={{ p: 3 }}>
        {/* Step 1: Combined Type and Category Selection */}
        {currentStep === 'category' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {/* Type Selection */}
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <ToggleButtonGroup
                value={selectedType}
                exclusive
                onChange={(event, newType) => {
                  if (newType !== null) {
                    setSelectedType(newType as TransactionType);
                  }
                }}
                aria-label="transaction type"
                size="large"
                sx={{
                  '& .MuiToggleButton-root': {
                    px: 3,
                    py: 2,
                    border: 1,
                    borderColor: 'grey.300',
                    '&.Mui-selected': {
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      '&:hover': {
                        bgcolor: 'primary.dark',
                      },
                    },
                    '&:hover': {
                      bgcolor: 'primary.50',
                    },
                  },
                }}
              >
                {typeOptions.map((option) => (
                  <ToggleButton
                    key={option.type}
                    value={option.type}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                      minWidth: 120,
                    }}
                  >
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        bgcolor: option.color,
                      }}
                    />
                    <Typography variant="body2" fontWeight="medium">
                      {option.label}
                    </Typography>
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>

            {/* Category Selection with Side Navigation */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {/* Left Navigation */}
              {totalPages > 1 && (
                <IconButton
                  onClick={handlePrevPage}
                  disabled={currentPage === 0}
                  size="large"
                  sx={{
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'grey.300',
                    '&:hover': {
                      bgcolor: 'primary.50',
                    },
                    '&:disabled': {
                      opacity: 0.3,
                    },
                  }}
                >
                  <ChevronLeft />
                </IconButton>
              )}

              {/* Category Grid */}
              <Box 
                sx={{ 
                  display: 'grid', 
                  gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' },
                  gap: 2,
                  minHeight: '280px', // Fixed height to prevent jumping
                  flex: 1,
                }}
              >
                {currentCategories.map((category) => {
                  const theme = getCategoryIconTheme(category.name);
                  
                  return (
                    <Card
                      key={category._id}
                      sx={{
                        border: 1,
                        borderColor: 'grey.200',
                        transition: 'all 0.2s ease-in-out',
                        backgroundColor: 'transparent',
                        height: '120px', // Fixed height for consistent sizing
                        '&:hover': {
                          borderColor: theme.primary,
                          transform: 'translateY(-2px)',
                          boxShadow: 2,
                        },
                      }}
                    >
                      <CardActionArea 
                        onClick={() => handleCategorySelect(category)} 
                        sx={{ 
                          p: 2, 
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                          <CategoryIcon
                            categoryName={category.name}
                            size="large"
                            variant="plain"
                            showBackground={false}
                            showTooltip={false}
                            onClick={() => handleCategorySelect(category)}
                            data-testid={`category-icon-${category._id}`}
                          />
                          <Typography 
                            variant="body2" 
                            fontWeight="medium" 
                            textAlign="center"
                            sx={{ 
                              color: 'text.primary',
                              lineHeight: 1.2,
                              maxHeight: '2.4em', // Max 2 lines
                              overflow: 'hidden',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                            }}
                          >
                            {category.name}
                          </Typography>
                        </Box>
                      </CardActionArea>
                    </Card>
                  );
                })}
              </Box>

              {/* Right Navigation */}
              {totalPages > 1 && (
                <IconButton
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages - 1}
                  size="large"
                  sx={{
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'grey.300',
                    '&:hover': {
                      bgcolor: 'primary.50',
                    },
                    '&:disabled': {
                      opacity: 0.3,
                    },
                  }}
                >
                  <ChevronRight />
                </IconButton>
              )}
            </Box>
          </Box>
        )}

        {/* Step 3: Subcategory Selection */}
        {currentStep === 'subcategory' && selectedCategory && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Floating buttons for subcategories */}
            <Box sx={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: 1.5,
              justifyContent: 'center'
            }}>
              {selectedCategory.subCategories?.map((subcategory) => (
                <Button
                  key={subcategory._id}
                  onClick={() => handleSubcategorySelect(subcategory)}
                  disabled={isLoading}
                  variant="contained"
                  sx={{
                    borderRadius: 3,
                    px: 3,
                    py: 1.5,
                    textTransform: 'none',
                    fontWeight: 'medium',
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    boxShadow: 2,
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      bgcolor: 'primary.dark',
                      transform: 'translateY(-2px)',
                      boxShadow: 4,
                    },
                    '&:disabled': {
                      opacity: 0.5,
                      transform: 'none',
                    },
                  }}
                >
                  {subcategory.name}
                </Button>
              )) || (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                  <Typography variant="body2" color="text.secondary">
                    No subcategories available
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        )}

        {isLoading && (
          <Backdrop
            sx={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0, 
              bgcolor: 'rgba(255, 255, 255, 0.75)',
              zIndex: 1000 
            }}
            open={isLoading}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <CircularProgress size={32} />
              <Typography variant="body2" color="text.secondary">
                Categorizing...
              </Typography>
            </Box>
          </Backdrop>
        )}
      </DialogContent>

      {/* Manual Categorization Dialog */}
      <ManualCategorizationDialog
        open={showManualDialog}
        onClose={() => setShowManualDialog(false)}
        onConfirm={handleManualCategorization}
        transaction={transaction}
        selectedCategory={selectedCategory}
        selectedSubCategory={selectedSubCategory}
      />
    </Dialog>
  );
};

export default EnhancedCategorizationDialog;
