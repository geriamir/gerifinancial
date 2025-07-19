# Smart Recurrence Pattern Detection - Testing Guide

This directory contains comprehensive integration tests for the Smart Recurrence Pattern Detection feature, which enhances budget auto-calculation with intelligent pattern recognition.

## 🎯 Feature Overview

The Smart Recurrence Pattern Detection feature automatically identifies recurring expense patterns in user transactions and incorporates them into budget calculations. It supports:

- **Bi-monthly patterns** (every 2 months) - e.g., municipal taxes
- **Quarterly patterns** (every 3 months) - e.g., insurance payments  
- **Yearly patterns** (every 12 months) - e.g., annual licenses

## 📋 Test Files

### Integration Tests
- **`patternDetectionIntegration.test.js`** - Comprehensive end-to-end testing
- **`runPatternTests.js`** - Test runner script with detailed output

### Unit Tests (Located in parent directories)
- **`../services/__tests__/recurrenceDetectionService.test.js`** - Pattern detection algorithms
- **`../routes/__tests__/budgetPatterns.test.js`** - API endpoint testing

## 🚀 Running Tests

### Quick Start
```bash
# Navigate to backend directory
cd backend

# Run integration tests with detailed output
node src/test-scenarios/runPatternTests.js
```

### Manual Test Execution
```bash
# Run specific integration tests
npx jest src/test-scenarios/patternDetectionIntegration.test.js --verbose

# Run all pattern-related tests
npx jest --testPathPattern="pattern" --verbose

# Run with coverage report
npx jest src/test-scenarios/patternDetectionIntegration.test.js --coverage
```

## 🧪 Test Scenarios

### 1. Bi-Monthly Pattern Detection
Tests detection of expenses that occur every other month:
- Municipal tax payments (Jan, Mar, May, Jul)
- Validates pattern confidence > 80%
- Ensures correct scheduled months calculation

### 2. Quarterly Pattern Detection  
Tests detection of expenses that occur every 3 months:
- Car insurance premiums (Jan, Apr, Jul, Oct)
- Validates pattern accuracy and timing
- Tests confidence scoring algorithm

### 3. Yearly Pattern Detection
Tests detection of annual expenses:
- Software license renewals (same month each year)
- Validates multi-year pattern recognition
- Tests yearly confidence calculations

### 4. Budget Integration
Tests end-to-end budget calculation with patterns:
- Mixed transaction scenarios (patterns + regular expenses)
- Validates pattern amounts are ADDED to regular averages
- Tests budget response includes pattern metadata

### 5. Pattern Approval Workflow
Tests the complete approval lifecycle:
- Pattern detection and storage
- Pending → Approved state transitions
- Active pattern retrieval and filtering

### 6. Edge Cases & Error Handling
Tests robustness with various scenarios:
- Insufficient transaction data
- Similar amounts with different descriptions
- Irregular transaction spacing

## 📊 Test Data Structure

Each test creates realistic transaction data:

```javascript
// Example bi-monthly municipal tax
{
  description: 'Municipal Tax Payment - City Hall',
  amount: -450,
  processedDate: new Date(2024, 0, 15), // January 15
  category: 'Tax',
  subCategory: 'Municipal'
}

// Example quarterly insurance
{
  description: 'Car Insurance Premium - InsureCo', 
  amount: -1200,
  processedDate: new Date(2024, 0, 10), // January 10
  category: 'Insurance',
  subCategory: 'Car'
}
```

## 🔧 Test Environment

- **Database**: In-memory MongoDB (no external dependencies)
- **Isolation**: Clean database for each test
- **Coverage**: Full service integration from detection to budget
- **Realism**: Actual transaction patterns with realistic amounts

## ✅ Expected Test Results

When tests pass successfully, you should see:

```
🧪 Testing bi-monthly pattern detection...
📊 Created 4 bi-monthly transactions and 3 regular transactions
🔍 Detected 1 patterns
✅ Bi-monthly pattern detected: municipal tax payment - city hall
   - Amount: ₪450
   - Confidence: 95.0%
   - Scheduled months: 1, 3, 5, 7, 9, 11

🧪 Testing quarterly pattern detection...
📊 Created 4 quarterly transactions  
🔍 Detected 1 patterns
✅ Quarterly pattern detected: car insurance premium - insureco
   - Amount: ₪1200
   - Confidence: 90.0%
   - Scheduled months: 1, 4, 7, 10

🧪 Testing budget integration with patterns...
📊 Created 9 mixed transactions
📈 Budget calculation results:
   - Total patterns detected: 1
   - Patterns for July: 1
   - Requires approval: true
   - Municipal tax budget for July: ₪450
   - Internet budget for July: ₪120
✅ Budget integration with patterns working correctly
```

## 🏗️ Architecture Overview

The testing suite validates this complete flow:

1. **Transaction Analysis** → RecurrenceDetectionService
2. **Pattern Detection** → Algorithm identifies recurring patterns  
3. **Pattern Storage** → TransactionPattern model saves detected patterns
4. **User Approval** → Patterns require user approval before activation
5. **Budget Integration** → Pattern amounts added to budget calculations
6. **API Access** → REST endpoints for pattern management

## 🐛 Troubleshooting

### Common Issues

**MongoDB Connection Errors**
```bash
npm install mongodb-memory-server --save-dev
```

**Jest Not Found**
```bash
npm install jest --save-dev
```

**Timeout Issues**
```bash
# Increase timeout for integration tests
npx jest --testTimeout=30000
```

### Debug Mode
```bash
# Run with debug output
DEBUG=* node src/test-scenarios/runPatternTests.js

# Run single test with detailed logging
npx jest --testNamePattern="bi-monthly" --verbose
```

## 📈 Performance Benchmarks

Expected performance metrics:
- Pattern detection: < 2 seconds for 100 transactions
- Budget calculation: < 1 second with patterns
- Database operations: < 500ms per pattern operation
- Memory usage: < 50MB for full test suite

## 🎯 Success Criteria

Tests validate that the feature meets these requirements:
- ✅ 90%+ accuracy in pattern detection
- ✅ Zero false positives for irregular transactions  
- ✅ Seamless user approval workflow
- ✅ Correct budget amount calculations
- ✅ Robust error handling
- ✅ Secure API access control

---

## 🚀 Next Steps

With backend testing complete, the feature is ready for:
1. **Frontend Component Development** (Phase 3)
2. **UI Integration** (Phase 4) 
3. **User Acceptance Testing** (Phase 5)

The backend foundation is solid and thoroughly tested! 🎉
