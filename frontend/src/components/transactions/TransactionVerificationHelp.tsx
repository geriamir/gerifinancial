import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Chip,
  Box,
  Stack
} from '@mui/material';
import {
  Keyboard as KeyboardIcon,
  KeyboardReturn as KeyboardReturnIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon
} from '@mui/icons-material';

interface ShortcutInfo {
  key: string;
  description: string;
}

interface TransactionVerificationHelpProps {
  open: boolean;
  onClose: () => void;
  shortcuts: ShortcutInfo[];
}

const KeyboardChip = ({ label }: { label: string }) => (
  <Chip
    label={label}
    size="small"
    variant="outlined"
    sx={{
      borderRadius: 1,
      height: 24,
      fontFamily: 'monospace',
      fontWeight: 'bold',
      backgroundColor: (theme) => 
        theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
      '& .MuiChip-label': {
        px: 1
      }
    }}
  />
);

export const TransactionVerificationHelp: React.FC<TransactionVerificationHelpProps> = ({
  open,
  onClose,
  shortcuts
}) => {
  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2
        }
      }}
    >
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <KeyboardIcon />
          <Typography variant="h6" component="span">
            Keyboard Shortcuts
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary" paragraph sx={{ mb: 3 }}>
          Use these keyboard shortcuts to quickly navigate and verify transactions:
        </Typography>

        <List sx={{ width: '100%' }}>
          {shortcuts.map((shortcut) => (
            <ListItem
              key={shortcut.key}
              sx={{
                py: 1.5,
                borderBottom: '1px solid',
                borderColor: 'divider',
                '&:last-child': {
                  borderBottom: 'none'
                }
              }}
            >
              <ListItemText
                primary={shortcut.description}
                sx={{ mr: 2 }}
              />
              <Box>
                <KeyboardChip label={shortcut.key} />
              </Box>
            </ListItem>
          ))}
        </List>

        <Box sx={{ mt: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Navigation Tips
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Use <KeyboardChip label="Tab" /> to move between elements,{' '}
            <KeyboardChip label="Space" /> or <KeyboardChip label="Enter" /> to activate buttons, 
            and <KeyboardChip label="Esc" /> to close popups.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          onClick={onClose}
          variant="contained"
          startIcon={<KeyboardReturnIcon />}
        >
          Got it
        </Button>
      </DialogActions>
    </Dialog>
  );
};
