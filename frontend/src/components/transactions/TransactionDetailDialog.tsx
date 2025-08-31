import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Paper,
  IconButton,
  CircularProgress,
  Alert,
  TextField,
  Autocomplete,
} from '@mui/material';
import {
  Close as CloseIcon,
  AccountBalance as MoneyIcon,
  CalendarToday as CalendarIcon,
  Description as DescriptionIcon,
  LocalOffer as TagIcon,
  Folder as ProjectIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import type { Transaction, Tag } from '../../services/api/types/transactions';
import { formatCurrencyDisplay } from '../../utils/formatters';
import { EnhancedCategorizationDialog } from './EnhancedCategorizationDialog';
import { transactionsApi } from '../../services/api/transactions';
import { useCategories } from '../../hooks/useCategories';
import CategoryIcon from '../common/CategoryIcon';
import TransactionBudgetExclusion from './TransactionBudgetExclusion';

interface TransactionDetailDialogProps {
  open: boolean;
  transaction: Transaction | null;
  onClose: () => void;
  onTransactionUpdated?: (updatedTransaction: Transaction) => void;
}

const TransactionDetailDialog: React.FC<TransactionDetailDialogProps> = ({
  open,
  transaction,
  onClose,
  onTransactionUpdated,
}) => {
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingTags, setPendingTags] = useState<string[]>([]);
  const [originalTags, setOriginalTags] = useState<string[]>([]);
  const { categories } = useCategories();

  useEffect(() => {
    if (!open) {
      setError(null);
      setUpdating(false);
      setPendingTags([]);
      setOriginalTags([]);
    } else if (transaction) {
      // Initialize pending tags with current transaction tags
      const currentTagNames = transaction.tags?.map(tag => 
        typeof tag === 'object' && tag !== null && '_id' in tag 
          ? (tag as Tag).name 
          : ''
      ).filter(Boolean) || [];
      setPendingTags([...currentTagNames]);
      setOriginalTags([...currentTagNames]);
    }
  }, [open, transaction]);

  useEffect(() => {
    if (open) {
      fetchTags();
    }
  }, [open]);

  const fetchTags = async () => {
    try {
      setTagsLoading(true);
      const tags = await transactionsApi.getTags();
      setAllTags(tags);
    } catch (err) {
      console.error('Failed to fetch tags:', err);
      setError('Failed to load tags');
    } finally {
      setTagsLoading(false);
    }
  };


  const savePendingChanges = async () => {
    if (!transaction) return;

    const tagsToAdd = pendingTags.filter(tag => !originalTags.includes(tag));
    const tagsToRemove = originalTags.filter(tag => !pendingTags.includes(tag));

    if (tagsToAdd.length === 0 && tagsToRemove.length === 0) {
      return; // No changes to save
    }

    try {
      setUpdating(true);
      setError(null);

      let updatedTransaction = transaction;

      // Remove tags first
      if (tagsToRemove.length > 0) {
        // Find tag IDs to remove
        const tagIdsToRemove: string[] = [];
        if (transaction.tags && Array.isArray(transaction.tags)) {
          for (const tag of transaction.tags) {
            if (typeof tag === 'object' && tag !== null && '_id' in tag) {
              const tagObj = tag as Tag;
              if (tagsToRemove.includes(tagObj.name)) {
                tagIdsToRemove.push(tagObj._id);
              }
            }
          }
        }

        if (tagIdsToRemove.length > 0) {
          updatedTransaction = await transactionsApi.removeTagsFromTransaction(
            transaction._id,
            tagIdsToRemove
          );
        }
      }

      // Add new tags
      if (tagsToAdd.length > 0) {
        updatedTransaction = await transactionsApi.addTagsToTransaction(
          updatedTransaction._id,
          tagsToAdd
        );
      }

      onTransactionUpdated?.(updatedTransaction);
      
      // Refresh tags list to include any newly created tags
      await fetchTags();
      
      // Update original tags to reflect saved state
      setOriginalTags([...pendingTags]);
    } catch (err) {
      console.error('Failed to save tag changes:', err);
      setError('Failed to save tag changes');
    } finally {
      setUpdating(false);
    }
  };

  const hasTagChanges = () => {
    if (pendingTags.length !== originalTags.length) return true;
    return !pendingTags.every(tag => originalTags.includes(tag));
  };

  if (!transaction) {
    return null;
  }

  const handleClose = async () => {
    if (hasTagChanges()) {
      await savePendingChanges();
    }
    onClose();
  };

  const handleCategoryEdit = () => {
    setCategoryDialogOpen(true);
  };



  const handleCategoryUpdate = async (categoryId: string, subCategoryId: string, saveAsManual?: boolean, matchingFields?: any) => {
    if (!transaction) return;
    
    try {
      setUpdating(true);
      setError(null);
      
      const response = await transactionsApi.categorizeTransaction(transaction._id, {
        categoryId,
        subCategoryId,
        saveAsManual,
        matchingFields,
      });
      
      // The response now always has the new format: { transaction: Transaction, historicalUpdates?: ... }
      const updatedTransaction = response.transaction;
      const historicalUpdates = response.historicalUpdates;
      
      // Update with the actual response from the server which includes populated category/subcategory
      onTransactionUpdated?.(updatedTransaction);
      
      // Show notification if historical transactions were updated
      if (historicalUpdates && historicalUpdates.updatedCount > 0) {
        setError(null); // Clear any existing errors first
        // Use a success message instead of error for this notification
        setTimeout(() => {
          alert(`✅ Successfully categorized this transaction and ${historicalUpdates.updatedCount} similar historical transactions!`);
        }, 500);
      }
      
      setCategoryDialogOpen(false);
      
    } catch (err) {
      console.error('Failed to update transaction category:', err);
      setError('Failed to update category. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const getTransactionTypeColor = (type?: string) => {
    switch (type) {
      case 'Expense':
        return 'error';
      case 'Income':
        return 'success';
      case 'Transfer':
        return 'info';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'EEEE, MMMM d, yyyy \'at\' h:mm a');
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2 }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Typography variant="h6" component="div">
            Transaction Details
          </Typography>
          <IconButton
            onClick={handleClose}
            sx={{ color: 'grey.500' }}
            aria-label="close"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Main Transaction Info */}
            <Paper sx={{ p: 3, bgcolor: 'grey.50' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <MoneyIcon color="primary" />
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Amount
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h5" component="div" sx={{ fontFamily: 'monospace' }}>
                      {formatCurrencyDisplay(transaction.amount, transaction.currency)}
                    </Typography>
                    {transaction.type && (
                      <Chip 
                        label={transaction.type} 
                        color={getTransactionTypeColor(transaction.type)}
                        size="small"
                      />
                    )}
                  </Box>
                </Box>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 1 }}>
                <DescriptionIcon sx={{ color: 'grey.600', fontSize: 20, mt: 0.25 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Description
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {transaction.description}
                  </Typography>
                </Box>
              </Box>

              {/* Category Information */}
              <Box 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: 2, 
                  mb: 1,
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: 'rgba(0, 0, 0, 0.04)',
                    borderRadius: 1
                  },
                }}
                onClick={handleCategoryEdit}
              >
                <CategoryIcon 
                  categoryName={transaction.category?.name}
                  subcategoryName={transaction.subCategory?.name}
                  size="small"
                  variant="plain"
                  showTooltip={false}
                />
                <Box sx={{ flex: 1 }}>
                  {transaction.category ? (
                    <>
                      {/* For Expense transactions: show category → subcategory */}
                      {transaction.category.type === 'Expense' && transaction.subCategory ? (
                        <>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {transaction.category.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {transaction.subCategory.name}
                          </Typography>
                        </>
                      ) : transaction.category.type !== 'Expense' ? (
                        /* For Income/Transfer transactions: show transaction type → category name */
                        <>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {transaction.category.type}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {transaction.category.name}
                          </Typography>
                        </>
                      ) : (
                        /* Expense transaction without subcategory - show incomplete */
                        <>
                          <Typography variant="caption" color="text.secondary" display="block">
                            Category
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                              {transaction.category.name} (incomplete)
                            </Typography>
                            <Chip label="Add subcategory" color="warning" size="small" />
                          </Box>
                        </>
                      )}
                    </>
                  ) : (
                    /* No category at all */
                    <>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Category
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          Uncategorized
                        </Typography>
                        <Chip label="Click to categorize" color="warning" size="small" />
                      </Box>
                    </>
                  )}
                  {updating && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      <CircularProgress size={12} />
                      <Typography variant="caption" color="text.secondary">
                        Updating...
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 1 }}>
                <CalendarIcon sx={{ color: 'grey.600', fontSize: 20, mt: 0.25 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Date
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(transaction.date)}
                  </Typography>
                </Box>
              </Box>

              {/* Tags Information - Always in edit mode */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 1 }}>
                <TagIcon sx={{ color: 'grey.600', fontSize: 20, mt: 0.25 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Tags
                  </Typography>
                  {(() => {
                    // Get all available tags for autocomplete
                    const availableOptions = allTags.map(tag => tag.name);

                    return (
                      <Box onClick={(e) => e.stopPropagation()}>
                        <Autocomplete
                          multiple
                          freeSolo
                          size="small"
                          sx={{ minWidth: 200 }}
                          options={availableOptions}
                          value={pendingTags}
                          onChange={(event, newValue) => {
                            if (event) {
                              event.stopPropagation();
                              (event.nativeEvent as any)?.stopImmediatePropagation?.();
                              event.preventDefault();
                            }
                            // Handle tag changes
                            setPendingTags(newValue as string[]);
                          }}
                          onOpen={(event) => {
                            if (event) {
                              event.stopPropagation();
                              (event.nativeEvent as any)?.stopImmediatePropagation?.();
                            }
                          }}
                          onClose={(event) => {
                            if (event) {
                              event.stopPropagation();
                              (event.nativeEvent as any)?.stopImmediatePropagation?.();
                            }
                          }}
                          clearOnBlur={false}
                          selectOnFocus={true}
                          handleHomeEndKeys={true}
                          renderTags={(tagNames, getTagProps) =>
                            tagNames.map((tagName, index) => {
                              // Find the tag object to get color info
                              const tagObj = allTags.find(tag => tag.name === tagName);
                              
                              // Remove "project:" prefix from project tags for display
                              const displayName = tagObj?.type === 'project' && tagName.startsWith('project:') 
                                ? tagName.substring(8) 
                                : tagName;
                              
                              return (
                                <Chip
                                  {...getTagProps({ index })}
                                  key={tagName}
                                  label={displayName}
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                  disabled={updating}
                                  sx={{
                                    backgroundColor: tagObj?.color ? `${tagObj.color}15` : undefined,
                                    borderColor: tagObj?.color || undefined,
                                  }}
                                />
                              );
                            })
                          }
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              placeholder={pendingTags.length === 0 ? "Add tags..." : ""}
                              variant="outlined"
                              disabled={updating || tagsLoading}
                              size="small"
                              onKeyDown={(e) => {
                                // Completely prevent all key event propagation
                                e.stopPropagation();
                                (e.nativeEvent as any)?.stopImmediatePropagation?.();
                              }}
                              onKeyUp={(e) => {
                                e.stopPropagation();
                                (e.nativeEvent as any)?.stopImmediatePropagation?.();
                              }}
                              onKeyPress={(e) => {
                                e.stopPropagation();
                                (e.nativeEvent as any)?.stopImmediatePropagation?.();
                              }}
                              onInput={(e) => {
                                e.stopPropagation();
                                (e.nativeEvent as any)?.stopImmediatePropagation?.();
                              }}
                              onChange={(e) => {
                                e.stopPropagation();
                                (e.nativeEvent as any)?.stopImmediatePropagation?.();
                              }}
                              onFocus={(e) => {
                                e.stopPropagation();
                                (e.nativeEvent as any)?.stopImmediatePropagation?.();
                              }}
                              onBlur={(e) => {
                                e.stopPropagation();
                                (e.nativeEvent as any)?.stopImmediatePropagation?.();
                              }}
                            />
                          )}
                          loading={tagsLoading}
                          disabled={updating}
                        />
                      </Box>
                    );
                  })()}
                </Box>
              </Box>
              
              {(transaction.memo || transaction.rawData?.memo) && (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                  <DescriptionIcon sx={{ color: 'grey.600', fontSize: 20, mt: 0.25 }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Additional Details
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {transaction.memo || transaction.rawData?.memo}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Paper>


            {/* Budget Exclusion Section - Only show for categorized expense transactions */}
            {transaction.category && (transaction.category.type === 'Expense' || transaction.category.type === 'Income') && (
              <Paper sx={{ p: 3, bgcolor: 'blue.50', border: '1px solid', borderColor: 'blue.200' }}>
                <TransactionBudgetExclusion
                  transaction={transaction}
                  onTransactionUpdated={onTransactionUpdated}
                />
              </Paper>
            )}

          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleClose} variant="outlined">
            {hasTagChanges() ? 'Save' : 'Close'}
          </Button>
        </DialogActions>
      </Dialog>

      <EnhancedCategorizationDialog
        open={categoryDialogOpen}
        onClose={() => setCategoryDialogOpen(false)}
        transaction={transaction}
        categories={categories}
        onCategorize={handleCategoryUpdate}
        isLoading={updating}
      />
    </>
  );
};

export default TransactionDetailDialog;
