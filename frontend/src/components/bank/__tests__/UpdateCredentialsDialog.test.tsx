import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UpdateCredentialsDialog } from '../UpdateCredentialsDialog';
import { bankAccountsApi } from '../../../services/api/bank';
import { BankAccount } from '../../../services/api/types';

jest.mock('../../../services/api/bank', () => ({
  bankAccountsApi: {
    updateCredentials: jest.fn()
  }
}));

const updateCredentials = bankAccountsApi.updateCredentials as jest.MockedFunction<
  typeof bankAccountsApi.updateCredentials
>;

const ibkrAccount = {
  _id: 'ibkr-account',
  bankId: 'ibkr',
  name: 'Interactive Brokers',
  status: 'active',
  lastScraped: null,
  scrapingConfig: {
    schedule: {
      frequency: 'daily',
      timeOfDay: '00:00'
    },
    options: {
      startDate: '2026-01-01T00:00:00.000Z',
      monthsBack: 12
    }
  }
} as BankAccount;

beforeEach(() => {
  jest.clearAllMocks();
  updateCredentials.mockResolvedValue({
    message: 'Credentials updated successfully',
    account: ibkrAccount
  });
});

it('updates IBKR with Flex credentials instead of a Mercury API token', async () => {
  const { unmount } = render(
    <UpdateCredentialsDialog
      open
      account={ibkrAccount}
      onClose={jest.fn()}
      onSuccess={jest.fn()}
    />
  );

  expect(screen.getByLabelText(/flex web service token/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/flex query id/i)).toBeInTheDocument();
  expect(screen.queryByLabelText(/^api token$/i)).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText(/flex web service token/i), {
    target: { value: 'new-flex-token' }
  });
  fireEvent.change(screen.getByLabelText(/flex query id/i), {
    target: { value: '12345' }
  });
  fireEvent.click(screen.getByRole('button', { name: /update flex credentials/i }));

  await waitFor(() =>
    expect(updateCredentials).toHaveBeenCalledWith('ibkr-account', {
      flexToken: 'new-flex-token',
      queryId: '12345'
    })
  );

  unmount();
});
