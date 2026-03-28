import React from 'react';
import { Paper, Box, Typography, Divider, useTheme } from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';

export interface SectionCardProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  noPadding?: boolean;
  sx?: SxProps<Theme>;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  subtitle,
  action,
  children,
  noPadding = false,
  sx,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Paper
      sx={[
        {
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          overflow: 'hidden',
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {(title || action) && (
        <>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 3,
              py: 2,
            }}
          >
            <Box>
              {title && (
                <Typography variant="h6" sx={{ fontSize: '1.05rem' }}>
                  {title}
                </Typography>
              )}
              {subtitle && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  {subtitle}
                </Typography>
              )}
            </Box>
            {action && <Box>{action}</Box>}
          </Box>
          <Divider />
        </>
      )}
      <Box sx={noPadding ? {} : { p: 3 }}>
        {children}
      </Box>
    </Paper>
  );
};

export default SectionCard;
