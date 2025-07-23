/**
 * NAVIGATION SIMPLIFICATION - Component Status
 * 
 * Status: ⏳ IN PROGRESS
 * Phase: 1.4
 * Last Updated: July 23, 2025
 * 
 * Implementation Notes:
 * - Transaction page tabs integrating bank management
 * - Three tabs: All Transactions, By Account, Bank Management
 * - URL-based tab state persistence using useUrlParams
 * - Maintains existing functionality while simplifying navigation
 * - Testing status: Pending
 */

import React, { useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Container,
  Typography,
  Button
} from '@mui/material';
import { RestartAlt as ResetIcon } from '@mui/icons-material';
import {
  Receipt as AllTransactionsIcon,
  AccountBalance as AccountIcon,
  Settings as BankManagementIcon
} from '@mui/icons-material';
import { useStringParam } from '../../hooks/useUrlParams';

// Import existing components
import { BankAccountsList } from '../bank/BankAccountsList';
import TransactionsList from './TransactionsList';
import FilterPanel from './FilterPanel';
import TransactionDetailDialog from './TransactionDetailDialog';
import { TransactionFilters } from '../../services/api/types';
import type { Transaction } from '../../services/api/types/transactions';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`transaction-tabpanel-${index}`}
      aria-labelledby={`transaction-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

const a11yProps = (index: number) => {
  return {
    id: `transaction-tab-${index}`,
    'aria-controls': `transaction-tabpanel-${index}`,
  };
};

export const TransactionTabs: React.FC = () => {
  // Use URL parameter for tab state persistence
  const [activeTab, setActiveTab] = useStringParam('tab', 'all');
  
  // Map tab names to indices
  const tabMap = {
    'all': 0,
    'by-account': 1,  
    'bank-management': 2
  };
  
  const reverseTabMap = ['all', 'by-account', 'bank-management'];
  
  const currentTabIndex = tabMap[activeTab as keyof typeof tabMap] ?? 0;

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    const tabName = reverseTabMap[newValue];
    setActiveTab(tabName);
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={currentTabIndex} 
            onChange={handleTabChange} 
            aria-label="transaction tabs"
            sx={{
              '& .MuiTab-root': {
                minHeight: 72,
                textTransform: 'none',
                fontSize: '1rem',
                fontWeight: 500
              }
            }}
          >
            <Tab 
              icon={<AllTransactionsIcon />}
              label="All Transactions" 
              {...a11yProps(0)}
              sx={{ 
                minWidth: 160,
                '& .MuiTab-iconWrapper': {
                  marginBottom: '4px'
                }
              }}
            />
            <Tab 
              icon={<AccountIcon />}
              label="By Account" 
              {...a11yProps(1)}
              sx={{ 
                minWidth: 160,
                '& .MuiTab-iconWrapper': {
                  marginBottom: '4px'
                }
              }}
            />
            <Tab 
              icon={<BankManagementIcon />}
              label="Bank Management" 
              {...a11yProps(2)}
              sx={{ 
                minWidth: 160,
                '& .MuiTab-iconWrapper': {
                  marginBottom: '4px'
                }
              }}
            />
          </Tabs>
        </Box>
        
        <TabPanel value={currentTabIndex} index={0}>
          {/* All Transactions Tab - Default transactions view */}
          <AllTransactionsView />
        </TabPanel>
        
        <TabPanel value={currentTabIndex} index={1}>
          {/* By Account Tab - Account-based transaction view */}
          <ByAccountView />
        </TabPanel>
        
        <TabPanel value={currentTabIndex} index={2}>
          {/* Bank Management Tab - Previously the Banks page */}
          <BankManagementView />
        </TabPanel>
      </Box>
    </Container>
  );
};

// Individual tab components
const AllTransactionsView: React.FC = () => {
  const [filters, setFilters] = useState<Partial<TransactionFilters>>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
    endDate: new Date(),
  });
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const updateFilters = (newFilters: Partial<TransactionFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const resetFilters = () => {
    setFilters({
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
    });
  };

  const handleTransactionClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setDetailDialogOpen(true);
  };

  const handleDetailDialogClose = () => {
    setDetailDialogOpen(false);
    setSelectedTransaction(null);
  };

  const handleTransactionUpdated = (updatedTransaction: Transaction) => {
    setSelectedTransaction(updatedTransaction);
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2">
          All Transactions
        </Typography>
        <Button
          startIcon={<ResetIcon />}
          onClick={resetFilters}
          size="small"
        >
          Reset Filters
        </Button>
      </Box>

      <FilterPanel
        startDate={filters.startDate}
        endDate={filters.endDate}
        type={filters.type}
        search={filters.search}
        onFilterChange={updateFilters}
      />

      <TransactionsList 
        filters={filters} 
        onRowClick={handleTransactionClick}
        refreshTrigger={refreshTrigger}
      />

      <TransactionDetailDialog
        open={detailDialogOpen}
        transaction={selectedTransaction}
        onClose={handleDetailDialogClose}
        onTransactionUpdated={handleTransactionUpdated}
      />
    </Box>
  );
};

const ByAccountView: React.FC = () => {
  return (
    <Box>
      {/* Account-based transactions view - to be implemented */}
      <Box sx={{ 
        textAlign: 'center', 
        py: 8,
        color: 'text.secondary'
      }}>
        <AccountIcon sx={{ fontSize: 48, mb: 2 }} />
        <div>Account-based transaction view</div>
        <div>Feature coming soon...</div>
      </Box>
    </Box>
  );
};

const BankManagementView: React.FC = () => {
  return (
    <Box>
      {/* Bank management - moved from Banks page */}
      <BankAccountsList />
    </Box>
  );
};

export default TransactionTabs;
