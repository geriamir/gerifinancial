import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  InputAdornment,
  Tooltip
} from '@mui/material';
import {
  Edit as EditIcon,
  Check as CheckIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { formatCurrency } from '../../utils/formatters';

interface InlineBudgetEditorProps {
  value: number;
  onSave: (newValue: number) => Promise<void>;
  label?: string;
  color?: 'success' | 'error' | 'primary' | 'inherit';
  size?: 'small' | 'medium';
  disabled?: boolean;
  placeholder?: string;
  variant?: 'body1' | 'body2' | 'h6';
}

const InlineBudgetEditor: React.FC<InlineBudgetEditorProps> = ({
  value,
  onSave,
  label,
  color = 'inherit',
  size = 'medium',
  disabled = false,
  placeholder = 'Enter amount',
  variant = 'body2'
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update edit value when prop value changes
  useEffect(() => {
    setEditValue(value.toString());
  }, [value]);

  const handleStartEdit = () => {
    if (disabled) return;
    setIsEditing(true);
    setError(null);
    setEditValue(value.toString());
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(value.toString());
    setError(null);
  };

  const handleSave = async () => {
    const numValue = parseFloat(editValue);
    
    // Validation
    if (isNaN(numValue)) {
      setError('Please enter a valid number');
      return;
    }
    
    if (numValue < 0) {
      setError('Amount cannot be negative');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      await onSave(numValue);
      setIsEditing(false);
    } catch (error: any) {
      setError(error.message || 'Failed to save');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSave();
    } else if (event.key === 'Escape') {
      handleCancel();
    }
  };

  const getColorValue = () => {
    switch (color) {
      case 'success': return 'success.main';
      case 'error': return 'error.main';
      case 'primary': return 'primary.main';
      default: return 'inherit';
    }
  };

  if (isEditing) {
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <TextField
          size="small"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyPress}
          autoFocus
          disabled={isLoading}
          error={!!error}
          helperText={error}
          InputProps={{
            startAdornment: <InputAdornment position="start">₪</InputAdornment>,
          }}
          placeholder={placeholder}
          sx={{ 
            minWidth: 120,
            '& .MuiFormHelperText-root': {
              position: 'absolute',
              bottom: -20,
              fontSize: '0.75rem'
            }
          }}
        />
        
        <IconButton
          size="small"
          onClick={handleSave}
          disabled={isLoading}
          color="primary"
        >
          <CheckIcon fontSize="small" />
        </IconButton>
        
        <IconButton
          size="small"
          onClick={handleCancel}
          disabled={isLoading}
          color="secondary"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    );
  }

  return (
    <Tooltip title={disabled ? '' : `Click to edit ${label || 'amount'}`}>
      <Box
        display="flex"
        alignItems="center"
        gap={0.5}
        onClick={handleStartEdit}
        sx={{
          cursor: disabled ? 'default' : 'pointer',
          '&:hover': disabled ? {} : {
            backgroundColor: 'action.hover',
            borderRadius: 1,
            px: 0.5,
            py: 0.25
          },
          transition: 'background-color 0.2s',
          borderRadius: 1,
          px: 0.5,
          py: 0.25
        }}
      >
        <Typography 
          variant={variant} 
          color={getColorValue()}
          sx={{ userSelect: 'none' }}
        >
          {formatCurrency(value)}
        </Typography>
        
        {!disabled && (
          <EditIcon 
            fontSize="small" 
            sx={{ 
              opacity: 0.5,
              fontSize: '1rem',
              '&:hover': { opacity: 1 }
            }} 
          />
        )}
      </Box>
    </Tooltip>
  );
};

export default InlineBudgetEditor;
