import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  Divider,
  IconButton,
  Box
} from '@mui/material';
import { Close as CloseIcon, Keyboard as KeyboardIcon } from '@mui/icons-material';

interface KeyboardShortcutProps {
  shortcut: string;
  description: string;
}

const KeyboardShortcut: React.FC<KeyboardShortcutProps> = ({ shortcut, description }) => (
  <ListItem disableGutters>
    <ListItemText
      primary={description}
      secondary={
        <Box
          component="kbd"
          sx={{
            px: 1,
            py: 0.5,
            borderRadius: 1,
            bgcolor: 'grey.100',
            border: 1,
            borderColor: 'grey.300',
            fontSize: '0.875rem',
            fontFamily: 'monospace'
          }}
        >
          {shortcut}
        </Box>
      }
      secondaryTypographyProps={{
        component: 'div',
        sx: { mt: 0.5 }
      }}
    />
  </ListItem>
);

interface ShortcutSectionProps {
  title: string;
  shortcuts: Array<{ key: string; description: string }>;
}

const ShortcutSection: React.FC<ShortcutSectionProps> = ({ title, shortcuts }) => (
  <>
    <Typography variant="subtitle1" color="primary" gutterBottom sx={{ mt: 2 }}>
      {title}
    </Typography>
    <List dense>
      {shortcuts.map((shortcut, index) => (
        <KeyboardShortcut
          key={index}
          shortcut={shortcut.key}
          description={shortcut.description}
        />
      ))}
    </List>
  </>
);

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
  open,
  onClose
}) => {
  // Basic keyboard shortcuts for transaction management
  const shortcuts = {
    global: [
      { key: '?', description: 'Show keyboard shortcuts' },
      { key: 'Esc', description: 'Close dialog or cancel action' }
    ],
    transactionPage: [
      { key: 'r', description: 'Reset filters' },
      { key: 'f', description: 'Focus search field' },
      { key: '/', description: 'Focus search field' }
    ],
    transactionList: [
      { key: 'Enter', description: 'Open transaction details' },
      { key: 'c', description: 'Categorize transaction' },
      { key: '↑/↓', description: 'Navigate between transactions' }
    ]
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="keyboard-shortcuts-dialog-title"
    >
      <DialogTitle id="keyboard-shortcuts-dialog-title">
        <Box display="flex" alignItems="center">
          <KeyboardIcon sx={{ mr: 1 }} />
          Keyboard Shortcuts
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <ShortcutSection title="Global Shortcuts" shortcuts={shortcuts.global} />
        <Divider sx={{ my: 2 }} />
        <ShortcutSection
          title="Transaction Page Shortcuts"
          shortcuts={shortcuts.transactionPage}
        />
        <Divider sx={{ my: 2 }} />
        <ShortcutSection
          title="Transaction List Shortcuts"
          shortcuts={shortcuts.transactionList}
        />

        <Typography variant="body2" color="text.secondary" sx={{ mt: 3, fontStyle: 'italic' }}>
          Note: On macOS, use ⌘ (Command) instead of Ctrl
        </Typography>
      </DialogContent>
    </Dialog>
  );
};
