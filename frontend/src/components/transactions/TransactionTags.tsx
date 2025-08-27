import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Chip,
  TextField,
  Autocomplete,
  IconButton,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  LocalOffer as TagIcon,
} from '@mui/icons-material';
import type { Transaction, Tag } from '../../services/api/types/transactions';
import { transactionsApi } from '../../services/api/transactions';

interface TransactionTagsProps {
  transaction: Transaction;
  onTransactionUpdated?: (updatedTransaction: Transaction) => void;
}

const TransactionTags: React.FC<TransactionTagsProps> = ({
  transaction,
  onTransactionUpdated,
}) => {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');

  // Get current transaction tags - handle both string IDs and populated objects
  const currentTags: Tag[] = [];
  if (transaction.tags) {
    for (const tag of transaction.tags) {
      if (typeof tag === 'object' && tag !== null && '_id' in tag) {
        currentTags.push(tag as Tag);
      }
    }
  }

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      setLoading(true);
      const tags = await transactionsApi.getTags();
      setAllTags(tags);
    } catch (err) {
      console.error('Failed to fetch tags:', err);
      setError('Failed to load tags');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = async (tagName: string) => {
    if (!tagName.trim()) return;

    try {
      setUpdating(true);
      setError(null);

      // Add the tag to the transaction
      const updatedTransaction = await transactionsApi.addTagsToTransaction(
        transaction._id,
        [tagName.trim()]
      );

      onTransactionUpdated?.(updatedTransaction);
      setInputValue('');
      
      // Refresh tags list to include any newly created tag
      await fetchTags();
    } catch (err) {
      console.error('Failed to add tag:', err);
      setError('Failed to add tag');
    } finally {
      setUpdating(false);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      setUpdating(true);
      setError(null);

      const updatedTransaction = await transactionsApi.removeTagsFromTransaction(
        transaction._id,
        [tagId]
      );

      onTransactionUpdated?.(updatedTransaction);
    } catch (err) {
      console.error('Failed to remove tag:', err);
      setError('Failed to remove tag');
    } finally {
      setUpdating(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && inputValue.trim()) {
      event.preventDefault();
      handleAddTag(inputValue.trim());
    }
  };

  const availableTags = allTags.filter(
    tag => !currentTags.some(currentTag => currentTag._id === tag._id)
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <TagIcon sx={{ color: 'grey.600', fontSize: 20 }} />
        <Typography variant="subtitle2" fontWeight="medium">
          Tags
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Current Tags */}
      {currentTags.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Current Tags
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {currentTags.map((tag) => (
              <Chip
                key={tag._id}
                label={tag.name}
                size="small"
                color="primary"
                variant="outlined"
                onDelete={() => handleRemoveTag(tag._id)}
                disabled={updating}
                sx={{
                  backgroundColor: tag.color ? `${tag.color}15` : undefined,
                  borderColor: tag.color || undefined,
                }}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Add Tag Section */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
        <Autocomplete
          size="small"
          sx={{ minWidth: 200, flex: 1 }}
          freeSolo
          options={availableTags.map(tag => tag.name)}
          inputValue={inputValue}
          onInputChange={(event, newInputValue) => setInputValue(newInputValue)}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Add tag"
              placeholder="Type tag name..."
              disabled={updating || loading}
              onKeyPress={handleKeyPress}
            />
          )}
          loading={loading}
          disabled={updating}
        />
        <IconButton
          onClick={() => handleAddTag(inputValue)}
          disabled={!inputValue.trim() || updating || loading}
          color="primary"
          size="small"
        >
          {updating ? <CircularProgress size={16} /> : <AddIcon />}
        </IconButton>
      </Box>

      {/* Help Text */}
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        Add tags to organize and track your transactions. Tags starting with "project:" can be used for project expense tracking.
      </Typography>
    </Box>
  );
};

export default TransactionTags;
