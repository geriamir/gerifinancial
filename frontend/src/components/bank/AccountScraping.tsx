import React, { useState } from 'react';
import { Button, CircularProgress, Typography } from '@mui/material';
import { bankAccountsApi } from '../../services/api/bank';
import { format } from 'date-fns';
import { track } from '../../utils/analytics';
import { BANK_ACCOUNT_EVENTS } from '../../constants/analytics';

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

  const handleScrape = async () => {
    setIsLoading(true);
    track(BANK_ACCOUNT_EVENTS.SCRAPE, { accountId });
    try {
      await bankAccountsApi.scrape(accountId, {});
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

  return (
    <>
      <Typography variant="body2" color="text.secondary">
        {lastScraped 
          ? `Last scraped: ${format(new Date(lastScraped), 'PPpp')}`
          : 'Never scraped'}
      </Typography>
      <Button
        variant="outlined"
        size="small"
        onClick={handleScrape}
        disabled={isLoading || isDisabled}
        startIcon={isLoading ? <CircularProgress size={20} /> : undefined}
      >
        {isLoading ? 'Scraping...' : 'Scrape Now'}
      </Button>
    </>
  );
};
