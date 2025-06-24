# Bank Transactions API

## Bank Account Endpoints

### Scrape Transactions
- **POST** `/api/bank-accounts/:id/scrape`
  - Description: Scrape transactions for a specific bank account
  - Authentication: Required
  - Parameters:
    - `id`: Bank account ID
  - Request Body:
    ```json
    {
      "showBrowser": boolean,
      "startDate": "ISO date string (optional)"
    }
    ```
  - Response:
    ```json
    {
      "newTransactions": number,
      "duplicates": number,
      "errors": string[]
    }
    ```

### Scrape All Accounts
- **POST** `/api/bank-accounts/scrape-all`
  - Description: Scrape transactions for all active bank accounts
  - Authentication: Required
  - Response:
    ```json
    {
      "totalAccounts": number,
      "successfulScrapes": number,
      "failedScrapes": number,
      "errors": [
        {
          "accountId": string,
          "accountName": string,
          "error": string
        }
      ]
    }
    ```

## Transaction Endpoints

### Get Account Transactions
- **GET** `/api/transactions/account/:accountId`
  - Description: Get transactions for a specific bank account
  - Authentication: Required
  - Query Parameters:
    - `startDate`: ISO date string (optional, defaults to 30 days ago)
    - `endDate`: ISO date string (optional, defaults to current date)

### Get Uncategorized Transactions
- **GET** `/api/transactions/uncategorized/:accountId`
  - Description: Get uncategorized transactions for a specific account
  - Authentication: Required

### Get Spending Summary
- **GET** `/api/transactions/summary/:accountId`
  - Description: Get spending summary for a specific account
  - Authentication: Required
  - Query Parameters:
    - `startDate`: ISO date string (optional, defaults to 30 days ago)
    - `endDate`: ISO date string (optional, defaults to current date)
  - Response:
    ```json
    {
      "totalExpenses": number,
      "totalIncome": number,
      "byCategory": {
        "categoryId": {
          "total": number,
          "count": number
        }
      }
    }
