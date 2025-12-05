# Transaction Deduplication Strategy

## Problem
The current deduplication relies solely on the `identifier` field from the bank scraper, which is not guaranteed to be unique. This causes duplicate transactions to be created, especially for boundary transactions that appear in consecutive scraping sessions.

## Current Issues
1. **Identifier Not Unique**: The `identifier` from israeli-bank-scrapers is not truly unique
2. **Boundary Overlap**: Using `lastScraped + 1 minute` still allows the last transaction to be retrieved again
3. **No Explicit Check**: Code catches error 11000 but there's no unique constraint on identifier
4. **Single Field Match**: Only checking identifier, not a combination of fields

## New Multi-Field Deduplication Strategy

### Deduplication Fields (Composite Key)
A transaction is considered a duplicate if ALL of the following match:
1. **accountId** - Same bank account
2. **date** - Same transaction date (to the day)
3. **amount** - Exact same amount
4. **description** - Same description text
5. **userId** - Same user (for data isolation)

### Additional Safety Checks
- **Memo field** (if available) - Extra validation for similar transactions
- **Transaction identifier** (if available) - Cross-reference check

### Implementation Strategy

#### Phase 1: Explicit Duplicate Detection
1. Before creating a transaction, query MongoDB for existing match
2. Use the multi-field index: `{ accountId: 1, date: 1, amount: 1, description: 1 }`
3. Check for exact match on all fields
4. Skip creation if duplicate found

#### Phase 2: Enhanced Boundary Handling
1. Use transaction date (not scraping time) for `lastScraped` updates
2. Add safety margin: Set `lastScraped` to the most recent transaction date + 1 day
3. This prevents boundary overlap while ensuring no gaps

#### Phase 3: Duplicate Cleanup Utility
1. Create admin utility to find and merge existing duplicates
2. Keep the earliest created version
3. Migrate any categorization/tags to the kept version
4. Delete duplicate records

## Benefits
1. **Reliable**: Multi-field matching is much more reliable than single identifier
2. **Performant**: Uses existing index, no performance degradation
3. **Safe**: Won't create duplicates even if identifier is non-unique
4. **Backward Compatible**: Works with existing data
5. **Auditable**: Logs all duplicate detections for monitoring

## Migration Path
1. Update `transactionService.processScrapedTransactions()` with explicit duplicate check
2. Update `dataSyncService` boundary handling logic
3. Test with known duplicate scenarios
4. Deploy to production
5. Run cleanup utility to remove existing duplicates (optional)

## Code Changes Required

### File: `backend/src/banking/services/transactionService.js`
- Add `async isDuplicate(transaction, bankAccount)` method
- Call before `Transaction.create()`
- Log duplicate detections
- Increment `results.duplicates` counter

### File: `backend/src/banking/services/dataSyncService.js`
- Update `updateBankAccountStatus()` to use transaction date + 1 day
- Improve boundary handling logic

### File: `backend/src/banking/models/Transaction.js`
- Consider adding compound unique index (optional, may cause issues with existing duplicates)
- Add static method `findPotentialDuplicate()`

## Testing Strategy
1. Unit tests for duplicate detection logic
2. Integration tests with mock scraper returning duplicates
3. Test boundary conditions (same day, next day, etc.)
4. Performance testing with large transaction sets
