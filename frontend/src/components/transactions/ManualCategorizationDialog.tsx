import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  FormControlLabel,
  Checkbox,
  TextField,
  Alert,
  Divider,
  Chip,
} from '@mui/material';
import { Category, SubCategory } from '../../services/api/types/categories';
import { Transaction } from '../../services/api/types/transactions';

interface ManualCategorizationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: {
    saveAsManual: boolean;
    matchingFields: {
      description?: string;
      memo?: string;
      rawCategory?: string;
    };
  }) => void;
  transaction: Transaction | null;
  selectedCategory: Category | null;
  selectedSubCategory: SubCategory | null;
}

export const ManualCategorizationDialog: React.FC<ManualCategorizationDialogProps> = ({
  open,
  onClose,
  onConfirm,
  transaction,
  selectedCategory,
  selectedSubCategory,
}) => {
  const [saveAsManual, setSaveAsManual] = useState(false);
  const [useDescription, setUseDescription] = useState(true);
  const [useMemo, setUseMemo] = useState(false);
  const [useRawCategory, setUseRawCategory] = useState(false);
  const [customDescription, setCustomDescription] = useState('');
  const [customMemo, setCustomMemo] = useState('');
  const [customRawCategory, setCustomRawCategory] = useState('');

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open && transaction) {
      setSaveAsManual(false);
      setUseDescription(true);
      setUseMemo(!!transaction.memo || !!transaction.rawData?.memo);
      setUseRawCategory(!!transaction.rawData?.category);
      setCustomDescription(transaction.description || '');
      setCustomMemo(transaction.memo || transaction.rawData?.memo || '');
      setCustomRawCategory(transaction.rawData?.category || '');
    }
  }, [open, transaction]);

  const handleConfirm = () => {
    const matchingFields: any = {};
    
    if (saveAsManual) {
      if (useDescription) {
        matchingFields.description = customDescription.trim();
      }
      if (useMemo && customMemo.trim()) {
        matchingFields.memo = customMemo.trim();
      }
      if (useRawCategory && customRawCategory.trim()) {
        matchingFields.rawCategory = customRawCategory.trim();
      }
    }

    onConfirm({
      saveAsManual,
      matchingFields,
    });
  };

  const getCategoryDisplayText = () => {
    if (!selectedCategory) return '';
    
    if (selectedCategory.type === 'Expense' && selectedSubCategory) {
      return `${selectedCategory.name} → ${selectedSubCategory.name}`;
    } else {
      return `${selectedCategory.type}: ${selectedCategory.name}`;
    }
  };

  if (!transaction || !selectedCategory) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle>
        Manual Categorization
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Transaction Summary */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Transaction
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {transaction.description}
            </Typography>
            {(transaction.memo || transaction.rawData?.memo) && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Memo: {transaction.memo || transaction.rawData?.memo}
              </Typography>
            )}
          </Box>

          {/* Selected Category */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Selected Category
            </Typography>
            <Chip 
              label={getCategoryDisplayText()}
              color="primary"
              sx={{ mt: 0.5 }}
            />
          </Box>

          <Divider />

          {/* Manual Categorization Options */}
          <Box>
            <FormControlLabel
              control={
                <Checkbox
                  checked={saveAsManual}
                  onChange={(e) => setSaveAsManual(e.target.checked)}
                />
              }
              label="Save this categorization rule for future automatic matching"
            />

            {saveAsManual && (
              <Box sx={{ mt: 2, pl: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Alert severity="info" sx={{ fontSize: '0.875rem' }}>
                  This rule will help automatically categorize similar transactions in the future.
                  Select which fields to use for matching:
                </Alert>

                {/* Description Field */}
                <Box>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={useDescription}
                        onChange={(e) => setUseDescription(e.target.checked)}
                      />
                    }
                    label="Use description for matching"
                  />
                  {useDescription && (
                    <Box sx={{ mt: 1, ml: 4 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                        Edit the text pattern that will be used to match similar transactions:
                      </Typography>
                      <TextField
                        fullWidth
                        multiline
                        rows={2}
                        value={customDescription}
                        onChange={(e) => setCustomDescription(e.target.value)}
                        placeholder="Enter the description pattern for matching (you can make it more general)"
                        helperText="Example: Remove specific amounts, dates, or reference numbers to create broader matching patterns"
                        sx={{ 
                          '& .MuiOutlinedInput-root': {
                            bgcolor: 'background.paper',
                          }
                        }}
                      />
                    </Box>
                  )}
                </Box>

                {/* Memo Field */}
                {(transaction.memo || transaction.rawData?.memo) && (
                  <Box>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={useMemo}
                          onChange={(e) => setUseMemo(e.target.checked)}
                        />
                      }
                      label="Use memo for matching"
                    />
                    {useMemo && (
                      <Box sx={{ mt: 1, ml: 4 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                          Edit the memo pattern that will be used to match similar transactions:
                        </Typography>
                        <TextField
                          fullWidth
                          multiline
                          rows={2}
                          value={customMemo}
                          onChange={(e) => setCustomMemo(e.target.value)}
                          placeholder="Enter the memo pattern for matching (you can make it more general)"
                          helperText="Example: Remove specific amounts, dates, or reference numbers to create broader matching patterns"
                          sx={{ 
                            '& .MuiOutlinedInput-root': {
                              bgcolor: 'background.paper',
                            }
                          }}
                        />
                      </Box>
                    )}
                  </Box>
                )}

                {/* Raw Category Field */}
                {transaction.rawData?.category && (
                  <Box>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={useRawCategory}
                          onChange={(e) => setUseRawCategory(e.target.checked)}
                        />
                      }
                      label="Use raw category for matching"
                    />
                    {useRawCategory && (
                      <Box sx={{ mt: 1, ml: 4 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                          Edit the raw category pattern that will be used to match similar transactions:
                        </Typography>
                        <TextField
                          fullWidth
                          multiline
                          rows={2}
                          value={customRawCategory}
                          onChange={(e) => setCustomRawCategory(e.target.value)}
                          placeholder="Enter the raw category pattern for matching (you can make it more general)"
                          helperText="Example: Remove specific amounts, dates, or reference numbers to create broader matching patterns"
                          sx={{ 
                            '& .MuiOutlinedInput-root': {
                              bgcolor: 'background.paper',
                            }
                          }}
                        />
                      </Box>
                    )}
                  </Box>
                )}

                {/* Validation */}
                {saveAsManual && !useDescription && !useMemo && !useRawCategory && (
                  <Alert severity="warning" sx={{ fontSize: '0.875rem' }}>
                    Please select at least one field for matching.
                  </Alert>
                )}
              </Box>
            )}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} variant="outlined">
          Cancel
        </Button>
        <Button 
          onClick={handleConfirm} 
          variant="contained"
          disabled={saveAsManual && !useDescription && !useMemo && !useRawCategory}
        >
          Categorize
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ManualCategorizationDialog;
