import React, { useState } from 'react';
import { Button, CircularProgress, Typography, Stack, Alert } from '@mui/material';
import { FindReplace as RecoverIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { bankAccountsApi } from '../../services/api/bank';
import { format } from 'date-fns';
import { track } from '../../utils/analytics';
import { BANK_ACCOUNT_EVENTS } from '../../constants/analytics';

interface ScrapeResult {
  message: string;
  queuedJobs?: string[];
  totalJobs?: number;
  priority?: string;
}

interface AccountScrapingProps {
  accountId: string;
  lastScraped: string | null;
  isDisabled?: boolean;
  onScrapingComplete?: () => void;
}

export const AccountScraping: React.FC<AccountScrapingProps> = ({ 
  accountId, 
  lastScraped, 
  isDisabled,
  onScrapingComplete 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null);
  const [recoverMessage, setRecoverMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleScrape = async () => {
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

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {lastScraped 
          ? `Last scraped: ${format(new Date(lastScraped), 'PPpp')}`
          : 'Never scraped'}
      </Typography>
      <Stack direction="row" spacing={1}>
        <Button
          variant="outlined"
          size="small"
          onClick={handleScrape}
          disabled={isLoading || isDisabled}
          startIcon={isLoading ? <CircularProgress size={20} /> : undefined}
        >
          {isLoading ? 'Scraping...' : 'Scrape Now'}
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
    </Stack>
  );
};
