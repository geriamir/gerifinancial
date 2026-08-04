import React, { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  FormControlLabel,
  Switch,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  AutoAwesome as SuggestIcon,
  Check as AcceptIcon,
  Close as RejectIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { budgetsApi, ProjectSuggestion } from '../../services/api/budgets';
import { formatCurrency } from '../../types/foreignCurrency';
import { formatCompactDate } from './ProjectExpensesCompactUtils';

interface ProjectSuggestionsDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  onAccepted: () => void;
}

/**
 * Review screen for transactions the matcher thinks belong to a project.
 *
 * Nothing here is tagged until the user says so: a wrongly tagged transaction
 * silently distorts what the project claims to have cost, so an accept is the
 * only thing that writes.
 */
const ProjectSuggestionsDialog: React.FC<ProjectSuggestionsDialogProps> = ({
  open,
  onClose,
  projectId,
  projectName,
  onAccepted
}) => {
  const [suggestions, setSuggestions] = useState<ProjectSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeUnlikely, setIncludeUnlikely] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(0);

  const load = useCallback(async (refresh: boolean, unlikely: boolean) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await budgetsApi.getProjectSuggestions(projectId, {
        refresh,
        includeUnlikely: unlikely
      });
      setSuggestions(result.data);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load suggestions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open) {
      setAccepted(0);
      setIncludeUnlikely(false);
      load(false, false);
    } else {
      setSuggestions([]);
      setError(null);
    }
  }, [open, load]);

  const handleToggleUnlikely = (next: boolean) => {
    setIncludeUnlikely(next);
    load(false, next);
  };

  const resolve = async (transactionId: string, action: 'accept' | 'reject') => {
    setBusyId(transactionId);
    setError(null);
    try {
      await budgetsApi.resolveProjectSuggestion(projectId, transactionId, action);
      setSuggestions(prev => prev.filter(s => s.transaction._id !== transactionId));
      if (action === 'accept') {
        setAccepted(prev => prev + 1);
        onAccepted();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || `Failed to ${action} suggestion`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SuggestIcon color="primary" />
        Suggested for {projectName}
        <Tooltip title="Look for new matches now">
          <span style={{ marginLeft: 'auto' }}>
            <IconButton
              size="small"
              aria-label="Look for new matches now"
              onClick={() => load(true, includeUnlikely)}
              disabled={loading || refreshing}
            >
              <RefreshIcon />
            </IconButton>
          </span>
        </Tooltip>
      </DialogTitle>

      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {accepted > 0 && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Added {accepted} transaction{accepted === 1 ? '' : 's'} to this project.
          </Alert>
        )}

        <FormControlLabel
          control={
            <Switch
              checked={includeUnlikely}
              onChange={(e) => handleToggleUnlikely(e.target.checked)}
              disabled={loading || refreshing}
            />
          }
          label="Also show the ones it doubted"
        />

        <Divider sx={{ my: 1 }} />

        {(loading || refreshing) && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && !refreshing && suggestions.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
            Nothing to review. New transactions are checked against this project
            as they are categorised.
          </Typography>
        )}

        {!loading && !refreshing && suggestions.map((s) => (
          <Box
            key={s.transaction._id}
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 2,
              py: 1.5,
              borderBottom: '1px solid',
              borderColor: 'divider'
            }}
          >
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="body2" fontWeight="bold" noWrap>
                  {s.transaction.description}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatCompactDate(s.transaction.date)}
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {formatCurrency(Math.abs(s.transaction.amount), s.transaction.currency)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                {s.transaction.category && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={
                      s.transaction.subCategory
                        ? `${s.transaction.category.name} › ${s.transaction.subCategory.name}`
                        : s.transaction.category.name
                    }
                  />
                )}
                {/* No confidence means the model was never reached. The candidate
                    still matched a budget line inside the project's dates, and
                    saying "0%" would misrepresent that as a bad match. */}
                <Chip
                  size="small"
                  color={s.confidence == null ? 'default' : s.confidence >= 0.8 ? 'success' : 'warning'}
                  label={s.confidence == null ? 'unscored' : `${Math.round(s.confidence * 100)}%`}
                />
              </Box>
              {s.reason && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  {s.reason}
                </Typography>
              )}
            </Box>

            <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
              <Button
                size="small"
                variant="contained"
                startIcon={<AcceptIcon />}
                disabled={busyId === s.transaction._id}
                onClick={() => resolve(s.transaction._id, 'accept')}
              >
                Add
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                startIcon={<RejectIcon />}
                disabled={busyId === s.transaction._id}
                onClick={() => resolve(s.transaction._id, 'reject')}
              >
                Not this
              </Button>
            </Box>
          </Box>
        ))}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProjectSuggestionsDialog;
