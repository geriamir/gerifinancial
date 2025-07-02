import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, IconButton, Collapse } from '@mui/material';
import {
  Timeline as TimelineIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';

interface PerformanceMetrics {
  operationName: string;
  startTime: number;
  endTime: number;
  duration: number;
}

interface PerformanceMonitorProps {
  componentName: string;
  metrics: PerformanceMetrics[];
}

const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  componentName,
  metrics,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [slowOperations, setSlowOperations] = useState<PerformanceMetrics[]>([]);
  const [averages, setAverages] = useState<Record<string, number>>({});

  useEffect(() => {
    // Calculate averages by operation type
    const totals: Record<string, { sum: number; count: number }> = {};
    metrics.forEach(metric => {
      if (!totals[metric.operationName]) {
        totals[metric.operationName] = { sum: 0, count: 0 };
      }
      totals[metric.operationName].sum += metric.duration;
      totals[metric.operationName].count += 1;
    });

    const newAverages: Record<string, number> = {};
    Object.entries(totals).forEach(([op, { sum, count }]) => {
      newAverages[op] = sum / count;
    });

    setAverages(newAverages);
    setSlowOperations(metrics.filter(m => m.duration > 100));
  }, [metrics]);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <Paper
      sx={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 9999,
        p: 2,
        maxWidth: 400,
        maxHeight: '80vh',
        overflow: 'auto',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <TimelineIcon sx={{ mr: 1 }} />
        <Typography variant="subtitle2">{componentName} Performance</Typography>
        <IconButton 
          size="small" 
          onClick={() => setIsExpanded(!isExpanded)}
          sx={{ ml: 'auto' }}
        >
          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      <Collapse in={isExpanded}>
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="error.main">
            Slow Operations ({slowOperations.length})
          </Typography>
          {slowOperations.map((op, index) => (
            <Box key={index} sx={{ mt: 1 }}>
              <Typography variant="caption" component="div">
                {op.operationName}: {op.duration.toFixed(2)}ms
              </Typography>
            </Box>
          ))}

          <Typography variant="caption" color="primary" sx={{ mt: 2, display: 'block' }}>
            Average Durations
          </Typography>
          {Object.entries(averages).map(([op, avg]) => (
            <Box key={op} sx={{ mt: 1 }}>
              <Typography variant="caption" component="div">
                {op}: {avg.toFixed(2)}ms
              </Typography>
            </Box>
          ))}
        </Box>
      </Collapse>

      {!isExpanded && slowOperations.length > 0 && (
        <Typography 
          variant="caption" 
          color="error" 
          sx={{ display: 'block', mt: 1 }}
        >
          ⚠️ {slowOperations.length} slow operations
        </Typography>
      )}
    </Paper>
  );
};

export default PerformanceMonitor;
