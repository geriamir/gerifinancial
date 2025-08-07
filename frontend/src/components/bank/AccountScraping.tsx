import React, { useState } from 'react';
import { Button, CircularProgress, Typography, Stack, Alert, Chip } from '@mui/material';
import { FactCheck as VerifyIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { bankAccountsApi } from '../../services/api/bank';
import { format } from 'date-fns';
import { track } from '../../utils/analytics';
import { BANK_ACCOUNT_EVENTS } from '../../constants/analytics';

interface ScrapeResult {
  newTransactions: number;
  duplicates: number;
  needsVerification: number;
  errors: Array<{ error: string }>;
  newInvestments?: number;
  updatedInvestments?: number;
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
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null);
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

        {scrapeResult?.needsVerification ? (
          <Button
            variant="outlined"
            size="small"
            color="warning"
            onClick={handleVerifyClick}
            startIcon={<VerifyIcon />}
          >
            Verify {scrapeResult.needsVerification} Transactions
          </Button>
        ) : null}
      </Stack>

      {scrapeResult && (
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip
              label={`${scrapeResult.newTransactions} New Transactions`}
              size="small"
              color="primary"
            />
            {scrapeResult.needsVerification > 0 && (
              <Chip
                label={`${scrapeResult.needsVerification} Need Verification`}
                size="small"
                color="warning"
              />
            )}
            {scrapeResult.duplicates > 0 && (
              <Chip
                label={`${scrapeResult.duplicates} Duplicates`}
                size="small"
                color="default"
              />
            )}
            {(scrapeResult.newInvestments || 0) > 0 && (
              <Chip
                label={`${scrapeResult.newInvestments} New Investments`}
                size="small"
                color="secondary"
              />
            )}
            {(scrapeResult.updatedInvestments || 0) > 0 && (
              <Chip
                label={`${scrapeResult.updatedInvestments} Updated Investments`}
                size="small"
                color="info"
              />
            )}
          </Stack>
          
          {scrapeResult.errors.length > 0 && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {scrapeResult.errors.length} error(s) occurred during scraping
            </Alert>
          )}
        </Stack>
      )}
    </Stack>
  );
};
