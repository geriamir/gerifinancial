import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
} from '@mui/material';
import { ArrowBack, Close } from '@mui/icons-material';
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
  const [currentStep, setCurrentStep] = useState<Step>('type');
  const [selectedType, setSelectedType] = useState<TransactionType>('Expense');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open && transaction) {
      // Pre-select type based on transaction amount
      const inferredType = transaction.amount < 0 ? 'Expense' : 'Income';
      setSelectedType(inferredType);
      setCurrentStep('type');
      setSelectedCategory(null);
    }
  }, [open, transaction]);

  // Filter categories by selected type
  const filteredCategories = categories.filter(cat => cat.type === selectedType);

  const handleTypeSelect = (type: TransactionType) => {
    setSelectedType(type);
    setCurrentStep('category');
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
      <div className="flex items-center justify-between p-6 border-b">
        <div className="flex items-center gap-3">
          {currentStep !== 'type' && (
            <IconButton
              onClick={handleBack}
              size="small"
            >
              <ArrowBack />
            </IconButton>
          )}
          <div>
            <DialogTitle className="text-lg font-semibold p-0">
              {currentStep === 'type' && 'Choose Transaction Type'}
              {currentStep === 'category' && `${selectedType} Categories`}
              {currentStep === 'subcategory' && selectedCategory?.name}
            </DialogTitle>
            <div className="text-sm text-gray-600 mt-1">
              {formatCurrencyDisplay(transaction.amount, transaction.currency)} • {transaction.description}
            </div>
          </div>
        </div>
        <IconButton
          onClick={onClose}
          size="small"
        >
          <Close />
        </IconButton>
      </div>

      <DialogContent className="p-6">
        {/* Step 1: Type Selection */}
        {currentStep === 'type' && (
          <div className="space-y-4">
            <div className="text-sm text-gray-600 mb-6">
              What type of transaction is this?
            </div>
            <div className="grid gap-4">
              {typeOptions.map((option) => (
                <button
                  key={option.type}
                  onClick={() => handleTypeSelect(option.type)}
                  className={`
                    p-4 rounded-lg border-2 text-left transition-all
                    hover:border-blue-300 hover:bg-blue-50
                    ${selectedType === option.type 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 bg-white'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: option.color }}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {option.label}
                      </div>
                      <div className="text-sm text-gray-600">
                        {option.description}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Category Selection */}
        {currentStep === 'category' && (
          <div className="space-y-4">
            <div className="text-sm text-gray-600 mb-6">
              Choose a category for this {selectedType.toLowerCase()}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {filteredCategories.map((category) => {
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
                  <button
                    key={category._id}
                    onClick={() => handleCategorySelect(category)}
                    className="
                      p-4 rounded-lg border-2 border-gray-200 
                      hover:border-blue-300 hover:bg-blue-50
                      transition-all text-center group
                    "
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="text-2xl">
                        {getCategoryEmoji(category.name)}
                      </div>
                      <div className="text-sm font-medium text-gray-900 group-hover:text-blue-600">
                        {category.name}
                      </div>
                      {category.subCategories && category.subCategories.length > 0 && (
                        <div className="text-xs text-gray-500">
                          {category.subCategories.length} options
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Subcategory Selection */}
        {currentStep === 'subcategory' && selectedCategory && (
          <div className="space-y-4">
            <div className="text-sm text-gray-600 mb-6">
              Choose a specific subcategory
            </div>
            <div className="grid gap-2">
              {selectedCategory.subCategories?.map((subcategory) => (
                <button
                  key={subcategory._id}
                  onClick={() => handleSubcategorySelect(subcategory)}
                  disabled={isLoading}
                  className="
                    p-3 rounded-lg border border-gray-200 text-left
                    hover:border-blue-300 hover:bg-blue-50
                    transition-all disabled:opacity-50
                  "
                >
                  <div className="font-medium text-gray-900">
                    {subcategory.name}
                  </div>
                  {subcategory.keywords && subcategory.keywords.length > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      Keywords: {subcategory.keywords.join(', ')}
                    </div>
                  )}
                </button>
              )) || (
                <div className="text-center text-gray-500 py-8">
                  No subcategories available
                </div>
              )}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <div className="text-sm text-gray-600 mt-2">Categorizing...</div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EnhancedCategorizationDialog;
