export const BANK_ACCOUNT_EVENTS = {
  VIEW_LIST: 'bank_account_view_list',
  OPEN_ADD_FORM: 'bank_account_open_add_form',
  ADD: 'bank_account_add',
  ADD_SUCCESS: 'bank_account_add_success',
  ADD_ERROR: 'bank_account_add_error',
  DELETE: 'bank_account_delete',
  DELETE_SUCCESS: 'bank_account_delete_success',
  DELETE_ERROR: 'bank_account_delete_error',
  TEST_CONNECTION: 'bank_account_test_connection',
  TEST_CONNECTION_SUCCESS: 'bank_account_test_connection_success',
  TEST_CONNECTION_ERROR: 'bank_account_test_connection_error',
  SCRAPE: 'bank_account_scrape',
  SCRAPE_SUCCESS: 'bank_account_scrape_success',
  SCRAPE_ERROR: 'bank_account_scrape_error',
  SCRAPE_ALL: 'bank_account_scrape_all',
  SCRAPE_ALL_SUCCESS: 'bank_account_scrape_all_success',
  SCRAPE_ALL_ERROR: 'bank_account_scrape_all_error'
} as const;

export type BankAccountEvent = keyof typeof BANK_ACCOUNT_EVENTS;
