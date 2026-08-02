import React from 'react';
import { Box, Paper, Avatar, keyframes } from '@mui/material';
import { AutoAwesome as AssistantIcon } from '@mui/icons-material';

const bounce = keyframes`
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40% { transform: translateY(-4px); opacity: 1; }
`;

/**
 * Shown while the next line is on its way, including while the server is doing
 * the work - a scrape can take a minute, and silence in a chat reads as a
 * failure rather than as progress.
 */
export const TypingIndicator: React.FC = () => (
  <Box
    sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-end', mb: 1.5 }}
    data-testid="chat-typing"
    aria-label="Assistant is typing"
  >
    <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
      <AssistantIcon fontSize="small" />
    </Avatar>
    <Paper
      elevation={0}
      sx={{
        px: 2,
        py: 1.5,
        borderRadius: 3,
        borderBottomLeftRadius: 0.5,
        border: 1,
        borderColor: 'divider',
        display: 'flex',
        gap: 0.75
      }}
    >
      {[0, 1, 2].map((index) => (
        <Box
          key={index}
          sx={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            bgcolor: 'text.secondary',
            animation: `${bounce} 1.2s infinite ease-in-out`,
            animationDelay: `${index * 0.16}s`
          }}
        />
      ))}
    </Paper>
  </Box>
);
