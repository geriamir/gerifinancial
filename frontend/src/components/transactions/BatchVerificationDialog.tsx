import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Button,
  Box,
  Stack,
  LinearProgress,
  Alert,
  Typography,
  Divider
} from '@mui/material';
import type { Transaction } from '../../services/api/types/transactions';
import type { BatchProgress } from '../../services/api/types/verification';
import { useVerificationAnalytics } from '../../hooks/useVerificationAnalytics';
import { useBatchVerificationKeyboard } from '../../hooks/useBatchVerificationKeyboard';
import { usePerformanceTracking } from '../../hooks/usePerformanceTracking';
import { PerformanceMetricsDisplay } from '../performance/PerformanceMetricsDisplay';
import { BatchTransactionList } from './BatchTransactionList';
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';

interface BatchVerificationDialogProps {
  open: boolean;
  onClose: () => void;
  onVerify: (transactionIds: string[]) => Promise<void>;
  transactions: Transaction[];
  mainTransaction?: Transaction;
  progress?: BatchProgress | null;
}

export const BatchVerificationDialog: React.FC<BatchVerificationDialogProps> = ({
  open,
  onClose,
  onVerify,
  transactions,
  mainTransaction,
  progress
}) => {
  const [isProcessing, setIsProcessing] = useState(!!progress);

  useEffect(() => {
    setIsProcessing(!!progress);
  }, [progress]);

  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showPerformance, setShowPerformance] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null);

  // Initialize focus when dialog opens
  useEffect(() => {
    if (open && transactions.length > 0) {
      setFocusedId(transactions[0]._id);
    }
  }, [open, transactions]);

  // Initialize with main transaction selected
  useEffect(() => {
    if (mainTransaction) {
      setSelectedIds([mainTransaction._id]);
    }
  }, [mainTransaction]);

  const { trackVerificationBatch } = useVerificationAnalytics();

  const { startTracking, stopTracking, addData } = usePerformanceTracking({
    name: 'batch_verification',
    category: 'transaction_processing',
    autoStart: false,
    onComplete: () => setShowPerformance(true),
    data: {
      transactionCount: transactions.length,
      totalAmount: transactions.reduce((sum, t) => sum + (t.amount || 0), 0),
      mainTransactionId: mainTransaction?._id
    }
  });

  const handleVerify = async () => {
    setError(null);
    setIsProcessing(true);
    setShowPerformance(false);
    const transactionIds = selectedIds;

    try {
      const startTime = Date.now();
      startTracking();

      await onVerify(transactionIds);

      const duration = Date.now() - startTime;
      trackVerificationBatch(transactionIds, true, duration);

      addData({
        success: true,
        duration,
        averageTimePerTransaction: duration / transactions.length,
        batchProgress: progress
      });

      const metrics = stopTracking()!;
      setPerformanceMetrics(metrics);
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to verify transactions';
      setError(errorMessage);
      trackVerificationBatch(transactionIds, false);

      addData({
        success: false,
        error: errorMessage,
        batchProgress: progress
      });
    } finally {
      const metrics = stopTracking()!;
      setPerformanceMetrics(metrics);
      setIsProcessing(false);
    }
  };

  const toggleHelp = () => setShowHelp(!showHelp);

  const handleSelectionChange = (id: string, selected: boolean) => {
    if (id === mainTransaction?._id) return; // Prevent unselecting main transaction
    setSelectedIds(prev =>
      selected ? [...prev, id] : prev.filter(x => x !== id)
    );
  };

  // Set up keyboard shortcuts
  const { registerShortcuts, unregisterShortcuts } = useBatchVerificationKeyboard({
    onConfirm: handleVerify,
    onClose,
    onToggleHelp: toggleHelp,
    isEnabled: open && !isProcessing,
    focusState: {
      focusedId,
      setFocusedId
    },
    onToggleSelection: (id: string) => {
      if (id !== mainTransaction?._id) {
        handleSelectionChange(id, !selectedIds.includes(id));
      }
    }
  });

  useEffect(() => {
    if (open) {
      registerShortcuts();
    }
    return () => unregisterShortcuts();
  }, [open, registerShortcuts, unregisterShortcuts]);

  return (
    <>
      <Dialog
        open={open}
        onClose={!isProcessing ? onClose : undefined}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Batch Verify Transactions
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <DialogContentText>
              Verify {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}?
            </DialogContentText>

            {error && (
              <Alert severity="error">
                {error}
              </Alert>
            )}

            {isProcessing ? (
              <Box sx={{ width: '100%' }}>
                <LinearProgress />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 1 }}
                >
                  Verifying transactions...
                </Typography>
                {progress && (
                  <Typography variant="body2" color="text.secondary">
                    Progress: {progress.current} / {progress.total}
                    ({progress.successful} successful, {progress.failed} failed)
                  </Typography>
                )}
              </Box>
            ) : (
              <>
                <BatchTransactionList
                  transactions={transactions}
                  mainTransaction={mainTransaction}
                  selectedIds={selectedIds}
                  onSelectionChange={handleSelectionChange}
                  focusedId={focusedId}
                  dense
                  maxHeight={300}
                />
                <KeyboardShortcutsHelp
                  open={showHelp}
                  onClose={() => setShowHelp(false)}
                />
              </>
            )}

            {showPerformance && (
              <Box>
                <Divider sx={{ my: 2 }} />
                <PerformanceMetricsDisplay
                  metrics={performanceMetrics}
                  threshold={transactions.length * 200} // 200ms per transaction threshold
                  showDetails
                  title="Batch Verification Performance"
                />
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={toggleHelp}
            disabled={isProcessing}
          >
            Keyboard Shortcuts
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button
            onClick={onClose}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleVerify}
            variant="contained"
            disabled={isProcessing}
            autoFocus
          >
            Verify {selectedIds.length} {selectedIds.length === 1 ? 'Transaction' : 'Transactions'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
