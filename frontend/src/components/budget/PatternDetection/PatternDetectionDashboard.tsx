import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  Chip,
  Box,
  CircularProgress,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import {
  Psychology as BrainIcon,
  TrendingUp,
  CalendarMonth as CalendarIcon,
  Warning as AlertCircleIcon,
  CheckCircle,
  AccessTime as ClockIcon,
  Repeat as RepeatIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { patternsApi, DetectedPattern } from '../../../services/api/patterns';
import { useAuth } from '../../../hooks/useAuth';

interface PatternDetectionDashboardProps {
  className?: string;
  sx?: any;
  refreshTrigger?: number; // Add trigger to force refresh
}

const PatternDetectionDashboard: React.FC<PatternDetectionDashboardProps> = ({ 
  className = '',
  sx,
  refreshTrigger
}) => {
  const { user } = useAuth();
  const [patterns, setPatterns] = useState<DetectedPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPatterns, setSelectedPatterns] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Debug log to check if component receives prop changes
  console.log('🔍 PatternDetectionDashboard: Component render - refreshTrigger:', refreshTrigger, 'user.id:', user?.id);

  // Load pending patterns
  useEffect(() => {
    if (!user?.id) return;
    
    loadPendingPatterns();
  }, [user?.id]);

  // Trigger refresh when refreshTrigger changes
  useEffect(() => {
    if (!user?.id) return;
    if (refreshTrigger === undefined || refreshTrigger === 0) return;
    
    console.log('🔄 PatternDetectionDashboard: refreshTrigger useEffect fired with value:', refreshTrigger);
    loadPendingPatterns();
  }, [refreshTrigger, user?.id]);

  const loadPendingPatterns = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 PatternDetectionDashboard: Loading pending patterns for user:', user.id);
      console.log('🔍 PatternDetectionDashboard: refreshTrigger value:', refreshTrigger);
      
      const response = await patternsApi.getPendingPatterns(user.id);
      
      console.log('🔍 PatternDetectionDashboard: API response:', response);
      
      if (response.success) {
        setPatterns(response.data.patterns);
        console.log('✅ PatternDetectionDashboard: Loaded patterns:', response.data.patterns.length);
        console.log('✅ PatternDetectionDashboard: Pattern details:', response.data.patterns);
      } else {
        console.error('❌ PatternDetectionDashboard: API returned success=false');
        throw new Error('Failed to load patterns');
      }
    } catch (err) {
      console.error('❌ PatternDetectionDashboard: Error loading patterns:', err);
      setError('Failed to load pattern data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePatternAction = async (patternId: string, action: 'approve' | 'reject', reason?: string) => {
    try {
      if (action === 'approve') {
        await patternsApi.approvePattern(patternId);
      } else {
        await patternsApi.rejectPattern(patternId, reason);
      }
      
      // Remove the pattern from the list
      setPatterns(prev => prev.filter(p => p.id !== patternId));
      
      // Show success message
      console.log(`Pattern ${action}d successfully`);
    } catch (err) {
      console.error(`Error ${action}ing pattern:`, err);
      setError(`Failed to ${action} pattern. Please try again.`);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedPatterns.length === 0) return;
    
    try {
      setBulkActionLoading(true);
      const response = await patternsApi.bulkApprovePatterns(selectedPatterns);
      
      if (response.success) {
        // Remove approved patterns from the list
        setPatterns(prev => prev.filter(p => !selectedPatterns.includes(p.id)));
        setSelectedPatterns([]);
        console.log(`Bulk approved ${response.data.totalApproved} patterns`);
      }
    } catch (err) {
      console.error('Error bulk approving patterns:', err);
      setError('Failed to approve patterns. Please try again.');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handlePatternSelect = (patternId: string, selected: boolean) => {
    setSelectedPatterns(prev => 
      selected 
        ? [...prev, patternId]
        : prev.filter(id => id !== patternId)
    );
  };

  const handleSelectAll = () => {
    if (selectedPatterns.length === patterns.length) {
      setSelectedPatterns([]);
    } else {
      setSelectedPatterns(patterns.map(p => p.id));
    }
  };

  const getPatternTypeIcon = (type: string) => {
    switch (type) {
      case 'bi-monthly':
        return <RepeatIcon fontSize="small" />;
      case 'quarterly':
        return <CalendarIcon fontSize="small" />;
      case 'yearly':
        return <TrendingUp fontSize="small" />;
      default:
        return <ClockIcon fontSize="small" />;
    }
  };

  const getPatternTypeColor = (type: string): 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'default' => {
    switch (type) {
      case 'bi-monthly':
        return 'info';
      case 'quarterly':
        return 'success';
      case 'yearly':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS'
    }).format(amount);
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <BrainIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">Smart Pattern Detection</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" mb={3}>
            AI-powered recurring expense detection
          </Typography>
          <Box display="flex" alignItems="center" justifyContent="center" py={4}>
            <CircularProgress size={32} sx={{ mr: 2 }} />
            <Typography>Loading patterns...</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box className={className} sx={{ display: 'flex', flexDirection: 'column', gap: 3, ...sx }}>
      {/* Header */}
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box display="flex" alignItems="center">
              <BrainIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Box>
                <Typography variant="h6">Smart Pattern Detection</Typography>
                <Typography variant="body2" color="text.secondary">
                  AI-powered recurring expense detection for better budgeting
                </Typography>
              </Box>
            </Box>
            <Chip 
              icon={<AlertCircleIcon />}
              label={`${patterns.length} pending`}
              color="warning"
              variant="outlined"
            />
          </Box>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Empty State */}
      {patterns.length === 0 && !loading && (
        <Card>
          <CardContent>
            <Box textAlign="center" py={4}>
              <CheckCircle sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                All Caught Up!
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                No new spending patterns detected. Our AI is continuously analyzing your transactions.
              </Typography>
              <Button 
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={loadPendingPatterns}
              >
                Re-analyze Transactions
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Patterns List */}
      {patterns.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Bulk Actions */}
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selectedPatterns.length === patterns.length}
                      indeterminate={selectedPatterns.length > 0 && selectedPatterns.length < patterns.length}
                      onChange={handleSelectAll}
                    />
                  }
                  label={`Select All (${selectedPatterns.length} of ${patterns.length})`}
                />
                
                {selectedPatterns.length > 0 && (
                  <Button
                    variant="contained"
                    startIcon={bulkActionLoading ? <CircularProgress size={16} /> : <CheckCircle />}
                    onClick={handleBulkApprove}
                    disabled={bulkActionLoading}
                  >
                    Approve Selected ({selectedPatterns.length})
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>

          {/* Individual Pattern Cards */}
          {patterns.map((pattern) => (
            <Card key={pattern.id} variant="outlined">
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box display="flex" alignItems="center" flex={1}>
                    <Checkbox
                      checked={selectedPatterns.includes(pattern.id)}
                      onChange={(e) => handlePatternSelect(pattern.id, e.target.checked)}
                      sx={{ mr: 2 }}
                    />
                    
                    <Box flex={1}>
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <Typography variant="subtitle1" fontWeight="medium">
                          {pattern.description}
                        </Typography>
                        <Chip
                          icon={getPatternTypeIcon(pattern.patternType)}
                          label={pattern.patternType}
                          size="small"
                          color={getPatternTypeColor(pattern.patternType)}
                        />
                      </Box>
                      
                      <Box display="flex" alignItems="center" gap={2} mb={1}>
                        <Typography variant="h6" color="primary">
                          {formatCurrency(pattern.amount)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {pattern.category} • {pattern.subcategory}
                        </Typography>
                      </Box>
                      
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body2" color="text.secondary">
                          Confidence: {Math.round(pattern.confidence * 100)}%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          • Occurs in months: {pattern.scheduledMonths.join(', ')}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                  
                  <Box display="flex" gap={1}>
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      onClick={() => handlePatternAction(pattern.id, 'reject')}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="contained"
                      color="success"
                      size="small"
                      onClick={() => handlePatternAction(pattern.id, 'approve')}
                    >
                      Approve
                    </Button>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default PatternDetectionDashboard;
