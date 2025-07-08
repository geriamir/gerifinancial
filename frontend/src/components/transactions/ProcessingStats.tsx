import React from 'react';
import { Box, Paper, Skeleton, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { ProcessingStats as IProcessingStats } from '../../services/api/types/transactions';

interface ProcessingStatsProps {
  stats: IProcessingStats;
  loading: boolean;
}

const statBoxStyles: SxProps<Theme> = {
  p: 2,
  minHeight: 100,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center'
};

const containerStyles: SxProps<Theme> = {
  display: 'grid',
  gridTemplateColumns: {
    xs: '1fr',
    sm: 'repeat(3, 1fr)'
  },
  gap: 2,
  width: '100%'
};

interface StatsBoxProps {
  label: string;
  value: number;
  loading: boolean;
}

const StatsBox = ({ label, value, loading }: StatsBoxProps) => (
  <Paper sx={statBoxStyles}>
    {loading ? (
      <Skeleton variant="rectangular" width="100%" height={60} />
    ) : (
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {label}
        </Typography>
        <Typography variant="h4">
          {value}
        </Typography>
      </Box>
    )}
  </Paper>
);

export const ProcessingStats = ({ stats, loading }: ProcessingStatsProps) => {
  return (
    <Box sx={containerStyles}>
      <StatsBox
        label="Pending Transactions"
        value={stats.pending}
        loading={loading}
      />
      <StatsBox
        label="Verified Transactions"
        value={stats.verified}
        loading={loading}
      />
      <StatsBox
        label="Total Transactions"
        value={stats.total}
        loading={loading}
      />
    </Box>
  );
};
