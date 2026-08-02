import React from 'react';
import { Box, Paper, Fade } from '@mui/material';

/**
 * Container for an interactive attachment. Indented to line up with the
 * assistant's bubbles rather than the avatar, so a form reads as part of what
 * was just said instead of as a separate page.
 */
export const CardShell: React.FC<{ children: React.ReactNode; testId?: string }> = ({
  children,
  testId
}) => (
  <Fade in timeout={300}>
    <Box sx={{ ml: { xs: 0, sm: '44px' }, mb: 2 }} data-testid={testId}>
      <Paper
        variant="outlined"
        sx={{ p: 2.5, borderRadius: 3, borderTopLeftRadius: 1, bgcolor: 'background.paper' }}
      >
        {children}
      </Paper>
    </Box>
  </Fade>
);
