// This is a placeholder for your actual analytics implementation
// Replace with your preferred analytics service (e.g., Google Analytics, Mixpanel)
export const track = (event: string, properties?: Record<string, any>) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics]', event, properties);
  }
  // Implement actual tracking here
  // analytics.track(event, properties);
};

// Bank Accounts
export const BANK_ACCOUNT_EVENTS = {
  OPEN_ADD_FORM: 'bank_account.open_add_form',
  CLOSE_ADD_FORM: 'bank_account.close_add_form',
  START_ADD: 'bank_account.start_add',
  ADD_SUCCESS: 'bank_account.add_success',
  ADD_ERROR: 'bank_account.add_error',
  DELETE: 'bank_account.delete',
  DELETE_SUCCESS: 'bank_account.delete_success',
  DELETE_ERROR: 'bank_account.delete_error',
  TEST_CONNECTION: 'bank_account.test_connection',
  TEST_CONNECTION_SUCCESS: 'bank_account.test_connection_success',
  TEST_CONNECTION_ERROR: 'bank_account.test_connection_error',
  VIEW_LIST: 'bank_account.view_list',
} as const;

export type BankAccountEvent = typeof BANK_ACCOUNT_EVENTS[keyof typeof BANK_ACCOUNT_EVENTS];
