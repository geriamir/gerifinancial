import React from 'react';
import {
  Paper,
  Typography,
  Stack,
  Box,
  LinearProgress,
  Tooltip,
  Chip,
  Skeleton,
  Theme
} from '@mui/material';
import type { SxProps } from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  AccessTime as TimeIcon,
  Speed as SpeedIcon
} from '@mui/icons-material';

interface VerificationStatsProps {
  totalVerified: number;
  totalPending: number;
  avgVerificationTime: number;
  batchVerificationRate: number;
  loading?: boolean;
  className?: string;
}

interface StatItemProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  tooltip: string;
  loading?: boolean;
}

// Custom grid components
const GridContainer = ({ children, ...props }: { children: React.ReactNode }) => (
  <Box display="grid" gridTemplateColumns="repeat(12, 1fr)" gap={2} {...props}>
    {children}
  </Box>
);

const GridItem = ({ children }: { children: React.ReactNode }) => (
  <Box gridColumn={{ xs: 'span 6', sm: 'span 3' }}>
    {children}
  </Box>
);

const StatItem: React.FC<StatItemProps> = ({ icon, value, label, tooltip, loading }) => (
  <GridItem>
    <Tooltip title={loading ? '' : tooltip}>
      <Stack alignItems="center" spacing={1}>
        {icon}
        {loading ? (
          <Skeleton variant="text" width={60} height={42}>
            <Typography variant="h4">000</Typography>
          </Skeleton>
        ) : (
          <Typography variant="h4">{value}</Typography>
        )}
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      </Stack>
    </Tooltip>
  </GridItem>
);

export const VerificationStats: React.FC<VerificationStatsProps> = ({
  totalVerified,
  totalPending,
  avgVerificationTime,
  batchVerificationRate,
  loading = false,
  className
}) => {
  const total = totalVerified + totalPending;
  const verificationRate = total > 0 ? (totalVerified / total) * 100 : 0;
  const formattedTime = (avgVerificationTime / 1000).toFixed(1); // Convert to seconds

  return (
    <Paper className={className} sx={{ p: 2, borderRadius: 2 }}>
      <Stack spacing={3}>
        <Typography variant="h6" gutterBottom>
          Verification Progress
        </Typography>

        <Box>
          <Stack direction="row" spacing={1} alignItems="center" mb={1}>
            {loading ? (
              <Skeleton width={200}>
                <Typography variant="body2">Loading progress...</Typography>
              </Skeleton>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary">
                  {totalVerified} of {total} verified
                </Typography>
                <Typography variant="body2" color="success.main">
                  ({verificationRate.toFixed(1)}%)
                </Typography>
              </>
            )}
          </Stack>
          {loading ? (
            <Skeleton variant="rectangular" height={8} sx={{ borderRadius: 1 }} />
          ) : (
            <LinearProgress
              variant="determinate"
              value={verificationRate}
              sx={{ height: 8, borderRadius: 1 }}
            />
          )}
        </Box>

        <GridContainer>
          <StatItem
            icon={<CheckCircleIcon color="success" />}
            value={totalVerified}
            label="Verified"
            tooltip="Total Verified Transactions"
            loading={loading}
          />
          <StatItem
            icon={<PendingIcon color="warning" />}
            value={totalPending}
            label="Pending"
            tooltip="Pending Verifications"
            loading={loading}
          />
          <StatItem
            icon={<TimeIcon color="primary" />}
            value={`${formattedTime}s`}
            label="Avg. Time"
            tooltip="Average Time per Verification"
            loading={loading}
          />
          <StatItem
            icon={<SpeedIcon color="info" />}
            value={`${(batchVerificationRate * 100).toFixed(0)}%`}
            label="Batch Rate"
            tooltip="Batch Verification Rate"
            loading={loading}
          />
        </GridContainer>

        {!loading && (
          <Box>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                icon={<SpeedIcon />}
                label={batchVerificationRate >= 0.5 ? 'Efficient' : 'Could be improved'}
                color={batchVerificationRate >= 0.5 ? 'success' : 'warning'}
              />
              {avgVerificationTime < 2000 && (
                <Chip
                  size="small"
                  icon={<TimeIcon />}
                  label="Fast verifications"
                  color="success"
                />
              )}
              {totalPending === 0 && total > 0 && (
                <Chip
                  size="small"
                  icon={<CheckCircleIcon />}
                  label="All verified"
                  color="success"
                />
              )}
            </Stack>
          </Box>
        )}
      </Stack>
    </Paper>
  );
};
