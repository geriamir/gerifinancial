import React from 'react';
import { Box, Paper, Typography, Avatar, Fade } from '@mui/material';
import { AutoAwesome as AssistantIcon } from '@mui/icons-material';

interface MessageBubbleProps {
  role: 'assistant' | 'user';
  text: string;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ role, text }) => {
  const isAssistant = role === 'assistant';

  return (
    <Fade in timeout={300}>
      <Box
        sx={{
          display: 'flex',
          gap: 1.5,
          alignItems: 'flex-end',
          flexDirection: isAssistant ? 'row' : 'row-reverse',
          mb: 1.5
        }}
        data-testid={`chat-message-${role}`}
      >
        {isAssistant && (
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
            <AssistantIcon fontSize="small" />
          </Avatar>
        )}

        <Paper
          elevation={0}
          sx={{
            px: 2,
            py: 1.25,
            maxWidth: '80%',
            borderRadius: 3,
            borderBottomLeftRadius: isAssistant ? 0.5 : 3,
            borderBottomRightRadius: isAssistant ? 3 : 0.5,
            bgcolor: isAssistant ? 'background.paper' : 'primary.main',
            color: isAssistant ? 'text.primary' : 'primary.contrastText',
            border: isAssistant ? 1 : 0,
            borderColor: 'divider'
          }}
        >
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
            {text}
          </Typography>
        </Paper>
      </Box>
    </Fade>
  );
};
