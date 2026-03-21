import React, { useState } from 'react';
import {
  Button,
  CircularProgress,
  Typography,
  Stack,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Box
} from '@mui/material';
import { FindReplace as RecoverIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { bankAccountsApi } from '../../services/api/bank';
import { pensionApi } from '../../services/api/pension';
import { format } from 'date-fns';
import { track } from '../../utils/analytics';
import { BANK_ACCOUNT_EVENTS } from '../../constants/analytics';

interface ScrapeResult {
  message: string;
  queuedJobs?: string[];
  totalJobs?: number;
  priority?: string;
}

const STRATEGY_DISPLAY_NAMES: Record<string, string> = {
  'checking-accounts': 'Checking',
  'investment-portfolios': 'Investments',
  'foreign-currency': 'Foreign Currency',
  'mercury-checking': 'Mercury Checking',
  'ibkr-flex': 'IBKR Flex',
  'phoenix-pension': 'Phoenix Pension'
};

const getBankStrategies = (bankId?: string): string[] => {
  switch (bankId) {
    case 'mercury': return ['mercury-checking'];
    case 'ibkr': return ['ibkr-flex'];
    case 'phoenix': return ['phoenix-pension'];
    default: return ['checking-accounts', 'investment-portfolios', 'foreign-currency'];
  }
};

interface AccountScrapingProps {
  accountId: string;
  bankId?: string;
  lastScraped: string | null;
  strategySync?: {
    [key: string]: {
      lastScraped: string | null;
      lastAttempted: string | null;
      status: 'success' | 'failed' | 'never';
    };
  };
  isDisabled?: boolean;
  onScrapingComplete?: () => void;
}

export const AccountScraping: React.FC<AccountScrapingProps> = ({ 
  accountId,
  bankId,
  lastScraped,
  strategySync,
  isDisabled,
  onScrapingComplete 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null);
  const [recoverMessage, setRecoverMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  // Phoenix OTP state
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [otpStep, setOtpStep] = useState<'sending' | 'input' | 'syncing'>('sending');
  const [otpDestination, setOtpDestination] = useState('');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);

  const handleScrape = async () => {
    if (bankId === 'phoenix') {
      handlePhoenixScrape();
      return;
    }

    setIsLoading(true);
    track(BANK_ACCOUNT_EVENTS.SCRAPE, { accountId });
    try {
      const result = await bankAccountsApi.scrape(accountId, {});
      setScrapeResult(result);
      track(BANK_ACCOUNT_EVENTS.SCRAPE_SUCCESS, { accountId });
      onScrapingComplete?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to scrape transactions';
      track(BANK_ACCOUNT_EVENTS.SCRAPE_ERROR, { accountId, error: errorMessage });
      console.error('Scraping failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoenixScrape = async () => {
    setOtpDialogOpen(true);
    setOtpStep('sending');
    setOtpError(null);
    setOtp('');
    try {
      const response = await pensionApi.initiateOtp(accountId);
      setOtpDestination(response.destination || '');
      setOtpStep('input');
    } catch (err: any) {
      setOtpError(err.response?.data?.error || err.message);
      setOtpStep('input');
    }
  };

  const handleOtpVerify = async () => {
    try {
      setOtpError(null);
      setOtpStep('syncing');
      const result = await pensionApi.verifyAndSync(accountId, otp);
      setScrapeResult({
        message: `Phoenix sync: ${result.synced} accounts synced, ${result.detailsFetched} details fetched`,
        totalJobs: result.synced
      });
      setOtpDialogOpen(false);
      onScrapingComplete?.();
    } catch (err: any) {
      setOtpError(err.response?.data?.error || err.message);
      setOtpStep('input');
    }
  };

  const handleOtpClose = () => {
    setOtpDialogOpen(false);
    setOtp('');
    setOtpError(null);
  };

  const handleVerifyClick = () => {
    navigate('/verify');
  };

  const handleRecover = async () => {
    setIsRecovering(true);
    setRecoverMessage(null);
    try {
      const result = await bankAccountsApi.recoverTransactions(accountId);
      const correctedDate = format(new Date(result.correctedLastScraped), 'PPpp');
      setRecoverMessage(`Scrape date reset to ${correctedDate}. Recovery scrape queued (${result.totalJobs} jobs).`);
      onScrapingComplete?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Recovery failed';
      setRecoverMessage(`Error: ${errorMessage}`);
      console.error('Recovery failed:', err);
    } finally {
      setIsRecovering(false);
    }
  };

  const relevantStrategies = getBankStrategies(bankId);
  const activeStrategies = strategySync 
    ? Object.entries(strategySync).filter(([key, s]) => s && s.status !== 'never' && relevantStrategies.includes(key))
    : [];

  return (
    <Stack spacing={2}>
      {activeStrategies.length > 0 ? (
        <Stack spacing={0}>
          {activeStrategies.map(([strategy, sync]) => (
            <Typography key={strategy} variant="body2" color="text.secondary">
              {STRATEGY_DISPLAY_NAMES[strategy] || strategy}:{' '}
              {sync.lastScraped
                ? format(new Date(sync.lastScraped), 'PPpp')
                : 'Never'}
            </Typography>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {lastScraped 
            ? `Last scraped: ${format(new Date(lastScraped), 'PPpp')}`
            : 'Never scraped'}
        </Typography>
      )}
      <Stack direction="row" spacing={1}>
        <Button
          variant="outlined"
          size="small"
          onClick={handleScrape}
          disabled={isLoading || isDisabled}
          startIcon={isLoading ? <CircularProgress size={20} /> : undefined}
        >
          {isLoading ? 'Scraping...' : bankId === 'phoenix' ? 'Sync (OTP)' : 'Scrape Now'}
        </Button>

        {scrapeResult && (
          <Button
            variant="outlined"
            size="small"
            color="warning"
            onClick={handleVerifyClick}
          >
            Verify Transactions
          </Button>
        )}

        {bankId !== 'phoenix' && (
          <Button
            variant="text"
            size="small"
            color="secondary"
            onClick={handleRecover}
            disabled={isRecovering || isLoading || isDisabled}
            startIcon={isRecovering ? <CircularProgress size={16} /> : <RecoverIcon />}
          >
            {isRecovering ? 'Recovering...' : 'Missing Transactions'}
          </Button>
        )}
      </Stack>

      {recoverMessage && (
        <Alert severity={recoverMessage.startsWith('Error') ? 'error' : 'success'} sx={{ mt: 1 }}>
          {recoverMessage}
        </Alert>
      )}

      {scrapeResult && (
        <Alert severity="success" sx={{ mt: 1 }}>
          {scrapeResult.message}
          {scrapeResult.totalJobs != null && ` (${scrapeResult.totalJobs} job(s) queued)`}
        </Alert>
      )}

      {/* Phoenix OTP Dialog */}
      <Dialog open={otpDialogOpen} onClose={handleOtpClose} maxWidth="sm" fullWidth>
        <DialogTitle>Phoenix Insurance — OTP Verification</DialogTitle>
        <DialogContent>
          {otpError && <Alert severity="error" sx={{ mb: 2 }}>{otpError}</Alert>}

          {otpStep === 'sending' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3 }}>
              <CircularProgress size={36} />
              <Typography sx={{ mt: 2 }}>Sending OTP code...</Typography>
            </Box>
          )}

          {otpStep === 'input' && (
            <Box sx={{ mt: 1 }}>
              <Typography sx={{ mb: 2 }}>
                Enter the OTP code sent to {otpDestination || 'your phone/email'}:
              </Typography>
              <TextField
                label="OTP Code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && otp) handleOtpVerify(); }}
                autoFocus
                fullWidth
              />
            </Box>
          )}

          {otpStep === 'syncing' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3 }}>
              <CircularProgress size={36} />
              <Typography sx={{ mt: 2 }}>Syncing Phoenix pension data...</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleOtpClose}>Cancel</Button>
          {otpStep === 'input' && (
            <Button variant="contained" onClick={handleOtpVerify} disabled={!otp}>
              Verify & Sync
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Stack>
  );
};
