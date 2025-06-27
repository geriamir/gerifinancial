import React, { useState } from 'react';
import { Button, CircularProgress } from '@mui/material';
import api from '../../services/api';
import { track } from '../../utils/analytics';
import { BANK_ACCOUNT_EVENTS } from '../../constants/analytics';
import { ScrapeResult } from '../../services/types/bankAccount';

interface ScrapeAllAccountsProps {
  disabled?: boolean;
  onScrapingComplete?: () => void;
}

export const ScrapeAllAccounts: React.FC<ScrapeAllAccountsProps> = ({ 
  disabled,
  onScrapingComplete 
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleScrapeAll = async () => {
    setIsLoading(true);
    track(BANK_ACCOUNT_EVENTS.SCRAPE_ALL);
    try {
      const result = await api.post<ScrapeResult>('/bank-accounts/scrape-all');
    
      if (result.data.failedScrapes > 0) {
        console.warn(`Failed to scrape ${result.data.failedScrapes} out of ${result.data.totalAccounts} accounts`);
        result.data.errors.forEach((error) => {
          console.error(`Failed to scrape ${error.accountName}:`, error.error);
        });
      }
      
      track(BANK_ACCOUNT_EVENTS.SCRAPE_ALL_SUCCESS);
      onScrapingComplete?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to scrape accounts';
      track(BANK_ACCOUNT_EVENTS.SCRAPE_ALL_ERROR, { error: errorMessage });
      console.error('Scraping all accounts failed:', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="contained"
      onClick={handleScrapeAll}
      disabled={isLoading || disabled}
      startIcon={isLoading ? <CircularProgress size={20} /> : undefined}
      sx={{ mb: 2 }}
    >
      {isLoading ? 'Scraping All Accounts...' : 'Scrape All Accounts'}
    </Button>
  );
};
