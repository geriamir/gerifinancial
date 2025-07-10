import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  Stack,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  InfoOutlined as InfoIcon,
  Timer as TimerIcon,
  Label as LabelIcon,
  DataUsage as DataIcon,
} from '@mui/icons-material';
import type { PerformanceMetrics } from '../../utils/analytics';

interface PerformanceMetricsDisplayProps {
  metrics: PerformanceMetrics;
  threshold?: number;
  showDetails?: boolean;
  title?: string;
  className?: string;
}

export const PerformanceMetricsDisplay: React.FC<PerformanceMetricsDisplayProps> = ({
  metrics,
  threshold = 1000, // Default threshold of 1 second
  showDetails = false,
  title,
  className
}) => {
  const {
    duration,
    startTime,
    endTime,
    tags,
    data
  } = metrics;

  const progress = Math.min((duration / threshold) * 100, 100);
  const isSlowPerformance = duration > threshold;

  const formatDuration = (ms: number): string => {
    if (ms < 1000) {
      return `${Math.round(ms)}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTimestamp = (time: number): string => {
    return new Date(time).toLocaleTimeString();
  };

  const getPerformanceColor = (progress: number): 'success' | 'warning' | 'error' => {
    if (progress <= 75) return 'success';
    if (progress <= 90) return 'warning';
    return 'error';
  };

  return (
    <Card className={className}>
      <CardContent>
        <Stack spacing={2}>
          {title && (
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Typography variant="h6" gutterBottom>
                {title}
              </Typography>
              <Tooltip title="Performance Metrics">
                <IconButton size="small">
                  <InfoIcon />
                </IconButton>
              </Tooltip>
            </Box>
          )}

          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Box display="flex" alignItems="center" gap={1}>
                <TimerIcon fontSize="small" />
                <Typography variant="body2">
                  Duration: {formatDuration(duration)}
                </Typography>
              </Box>
              <Typography
                variant="body2"
                color={isSlowPerformance ? 'error' : 'success.main'}
              >
                {progress.toFixed(0)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progress}
              color={getPerformanceColor(progress)}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>

          {showDetails && (
            <>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Timing Details
                </Typography>
                <Stack spacing={1}>
                  <Typography variant="body2" color="text.secondary">
                    Start: {formatTimestamp(startTime)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    End: {formatTimestamp(endTime)}
                  </Typography>
                </Stack>
              </Box>

              {Object.keys(tags).length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    <Box display="flex" alignItems="center" gap={1}>
                      <LabelIcon fontSize="small" />
                      Tags
                    </Box>
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" gap={1}>
                    {Object.entries(tags).map(([key, value]) => (
                      <Chip
                        key={key}
                        label={`${key}: ${value}`}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Stack>
                </Box>
              )}

              {Object.keys(data).length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    <Box display="flex" alignItems="center" gap={1}>
                      <DataIcon fontSize="small" />
                      Additional Data
                    </Box>
                  </Typography>
                  <Box
                    sx={{
                      backgroundColor: 'grey.50',
                      p: 1,
                      borderRadius: 1,
                      maxHeight: 200,
                      overflow: 'auto'
                    }}
                  >
                    <pre style={{ margin: 0, fontSize: '0.75rem' }}>
                      {JSON.stringify(data, null, 2)}
                    </pre>
                  </Box>
                </Box>
              )}
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};
