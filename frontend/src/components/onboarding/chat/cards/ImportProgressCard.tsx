import React from 'react';
import { Box, Typography, LinearProgress, Alert } from '@mui/material';
import {
  CloudSync as CloudSyncIcon,
  Download as DownloadIcon,
  Psychology as PsychologyIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { CardShell } from '../CardShell';
import { CardProps } from '../types';

type Stage = { icon: React.ReactNode; text: string; detail: string };

/**
 * The one card that talks back while the user waits. The scrape is already
 * running by the time this appears - it starts when the account is saved - so
 * this reports on work in flight rather than starting any.
 */
export const ImportProgressCard: React.FC<CardProps> = ({ status }) => {
  const scraping = status.transactionImport?.scrapingStatus;
  const progress = scraping?.progress || 0;
  const failed = scraping?.status === 'error' || scraping?.status === 'failed' || !!scraping?.error;
  const stage = describeStage(scraping);

  return (
    <CardShell testId="transaction-import-status">
      {failed ? (
        <Alert severity="error" data-testid="status-message">
          {scraping?.error || scraping?.message || 'Something went wrong during the import.'}
        </Alert>
      ) : (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
            {stage.icon}
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" data-testid="status-message">
                {stage.text}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {stage.detail}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              {progress}%
            </Typography>
          </Box>

          <LinearProgress
            data-testid="progress-bar"
            variant="determinate"
            value={progress}
            sx={{ height: 6, borderRadius: 3 }}
          />
        </>
      )}
    </CardShell>
  );
};

const describeStage = (scraping?: { status: string | null; message: string | null }): Stage => {
  switch (scraping?.status) {
    case 'connecting':
      return {
        icon: <CloudSyncIcon color="primary" />,
        text: 'Connecting to Bank',
        detail: scraping.message || 'Signing in to your account.'
      };
    case 'scraping':
    case 'in-progress':
      return {
        icon: <DownloadIcon color="primary" />,
        text: 'Importing Transactions',
        detail: scraping.message || 'Pulling the last six months across.'
      };
    case 'categorizing':
      return {
        icon: <PsychologyIcon color="primary" />,
        text: 'Sorting into categories',
        detail: scraping.message || 'Working out what each transaction was for.'
      };
    case 'complete':
      return {
        icon: <CheckCircleIcon color="success" />,
        text: 'Import Complete',
        detail: scraping.message || 'Everything is in.'
      };
    case 'error':
    case 'failed':
      return {
        icon: <ErrorIcon color="error" />,
        text: 'Import Failed',
        detail: scraping.message || 'Something went wrong.'
      };
    default:
      return {
        icon: <CloudSyncIcon color="primary" />,
        text: 'Getting started',
        detail: scraping?.message || 'Setting up the import.'
      };
  }
};
