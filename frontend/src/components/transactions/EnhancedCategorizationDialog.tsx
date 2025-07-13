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

interface EnhancedCategorizationDialogProps {
  open: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  categories: Category[];
  onCategorize: (categoryId: string, subCategoryId: string) => Promise<void>;
  isLoading: boolean;
}

type Step = 'type' | 'category' | 'subcategory';

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
  const [currentPage, setCurrentPage] = useState(0);

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
    if (category.subCategories && category.subCategories.length > 0) {
      setCurrentStep('subcategory');
    } else {
      // No subcategories, complete categorization
      handleComplete(category._id, '');
    }
  };

  const handleSubcategorySelect = (subcategory: SubCategory) => {
    if (selectedCategory) {
      handleComplete(selectedCategory._id, subcategory._id);
    }
  };

  const handleComplete = async (categoryId: string, subCategoryId: string) => {
    try {
      await onCategorize(categoryId, subCategoryId);
      onClose();
    } catch (error) {
      console.error('Failed to categorize transaction:', error);
    }
  };

  const handleBack = () => {
    if (currentStep === 'subcategory') {
      setCurrentStep('category');
    } else if (currentStep === 'category') {
      setCurrentStep('type');
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
          {currentStep !== 'type' && (
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
              {currentStep === 'subcategory' && selectedCategory?.name}
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
                  // Simple emoji mapping for category icons
                  const getCategoryEmoji = (categoryName: string) => {
                    const name = categoryName.toLowerCase();
                    if (name.includes('food') || name.includes('eating')) return '🍽️';
                    if (name.includes('transport') || name.includes('car')) return '🚗';
                    if (name.includes('shop') || name.includes('groceries')) return '🛍️';
                    if (name.includes('entertainment') || name.includes('movie')) return '🎬';
                    if (name.includes('health') || name.includes('medical')) return '🏥';
                    if (name.includes('utilities') || name.includes('electric')) return '⚡';
                    if (name.includes('education') || name.includes('school')) return '📚';
                    if (name.includes('travel') || name.includes('flight')) return '✈️';
                    if (name.includes('salary') || name.includes('income')) return '💰';
                    if (name.includes('investment') || name.includes('savings')) return '📈';
                    if (name.includes('household') || name.includes('home')) return '🏠';
                    if (name.includes('family') || name.includes('kids')) return '👨‍👩‍👧‍👦';
                    return '📁';
                  };

                  return (
                    <Card
                      key={category._id}
                      sx={{
                        border: 1,
                        borderColor: 'grey.200',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          borderColor: 'primary.main',
                          bgcolor: 'primary.50',
                          transform: 'translateY(-2px)',
                          boxShadow: 2,
                        },
                      }}
                    >
                      <CardActionArea onClick={() => handleCategorySelect(category)} sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                          <Typography variant="h4" component="div">
                            {getCategoryEmoji(category.name)}
                          </Typography>
                          <Typography 
                            variant="body2" 
                            fontWeight="medium" 
                            textAlign="center"
                            sx={{ 
                              color: 'text.primary',
                              '&:hover': { color: 'primary.main' },
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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Choose a specific subcategory
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {selectedCategory.subCategories?.map((subcategory) => (
                <Button
                  key={subcategory._id}
                  onClick={() => handleSubcategorySelect(subcategory)}
                  disabled={isLoading}
                  variant="outlined"
                  sx={{
                    p: 2,
                    textAlign: 'left',
                    justifyContent: 'flex-start',
                    border: 1,
                    borderColor: 'grey.200',
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: 'primary.50',
                    },
                    '&:disabled': {
                      opacity: 0.5,
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <Typography variant="body1" fontWeight="medium">
                      {subcategory.name}
                    </Typography>
                    {subcategory.keywords && subcategory.keywords.length > 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                        Keywords: {subcategory.keywords.join(', ')}
                      </Typography>
                    )}
                  </Box>
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
    </Dialog>
  );
};

export default EnhancedCategorizationDialog;
