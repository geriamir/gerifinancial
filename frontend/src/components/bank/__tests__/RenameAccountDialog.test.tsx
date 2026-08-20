import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RenameAccountDialog } from '../RenameAccountDialog';
import { bankAccountsApi } from '../../../services/api/bank';
import { BankAccount } from '../../../services/api/types';

jest.mock('../../../services/api/bank', () => ({
  bankAccountsApi: {
    update: jest.fn()
  }
}));

const updateAccount = bankAccountsApi.update as jest.MockedFunction<typeof bankAccountsApi.update>;
const account = {
  _id: 'cal-account',
  bankId: 'visaCal',
  name: 'Visa Cal Credit Cards',
  status: 'active',
  lastScraped: null,
  scrapingConfig: {
    schedule: { frequency: 'daily', timeOfDay: '02:00' },
    options: { startDate: '2026-01-01', monthsBack: 12 }
  }
} satisfies BankAccount;

it('saves a distinct account name', async () => {
  const user = userEvent.setup();
  const onClose = jest.fn();
  const onSuccess = jest.fn();
  updateAccount.mockResolvedValue({ ...account, name: 'Personal CAL' });

  render(
    <RenameAccountDialog
      open
      account={account}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );

  const name = screen.getByLabelText(/account name/i);
  await user.clear(name);
  await user.type(name, 'Personal CAL');
  await user.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => {
    expect(updateAccount).toHaveBeenCalledWith('cal-account', { name: 'Personal CAL' });
  });
  expect(onSuccess).toHaveBeenCalled();
  expect(onClose).toHaveBeenCalled();
});
