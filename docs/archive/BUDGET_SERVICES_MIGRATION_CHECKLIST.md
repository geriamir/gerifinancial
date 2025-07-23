# Budget Services Migration Checklist

## For Developers Working with Budget Services

This checklist helps ensure your code is updated correctly after the budget services refactoring and reorganization.

## ✅ Import Path Updates

### Check Your Imports
Replace old import paths with new ones:

```diff
// OLD - Remove these
- const budgetService = require('./budgetService');
- const budgetService = require('../services/budgetService');
- const budgetService = require('../../services/budgetService');

// NEW - Use these instead
+ const budgetService = require('./budget/budgetService');
+ const budgetService = require('../services/budget/budgetService');
+ const budgetService = require('../../services/budget/budgetService');
```

### Service-Specific Updates

#### budgetService.js
```diff
- require('../services/budgetService')
+ require('../services/budget/budgetService')
```

#### budgetCalculationService.js
```diff
- require('../services/budgetCalculationService')
+ require('../services/budget/budgetCalculationService')
```

#### projectBudgetService.js
```diff
- require('../services/projectBudgetService')
+ require('../services/budget/projectBudgetService')
```

#### yearlyBudgetService.js
```diff
- require('../services/yearlyBudgetService')
+ require('../services/budget/yearlyBudgetService')
```

## ✅ File Locations

### Where to Find Services Now

| Service | Old Location | New Location |
|---------|-------------|--------------|
| Main Budget Service | `services/budgetService.js` | `services/budget/budgetService.js` |
| Budget Calculations | `services/budgetCalculationService.js` | `services/budget/budgetCalculationService.js` |
| Project Budgets | `services/projectBudgetService.js` | `services/budget/projectBudgetService.js` |
| Yearly Budgets | `services/yearlyBudgetService.js` | `services/budget/yearlyBudgetService.js` |

## ✅ Testing Updates

### Test File Imports
Update any test files that import budget services:

```diff
// In test files
- const budgetService = require('../../src/services/budgetService');
+ const budgetService = require('../../src/services/budget/budgetService');
```

### Recommended Test Structure
```
backend/src/services/__tests__/
├── budget/
│   ├── budgetService.test.js
│   ├── budgetCalculationService.test.js
│   ├── projectBudgetService.test.js
│   └── yearlyBudgetService.test.js
└── import-verification.test.js
```

### Run Import Verification Test
```bash
# Test that all imports work correctly
cd backend
npm test -- --testPathPattern="import-verification"
```

## ✅ Common Import Patterns

### From Routes (`backend/src/routes/`)
```javascript
const budgetService = require('../services/budget/budgetService');
```

### From Services (`backend/src/services/`)
```javascript
const budgetService = require('./budget/budgetService');
```

### From Other Services (`backend/src/services/other/`)
```javascript
const budgetService = require('../budget/budgetService');
```

### From Root Tests (`backend/`)
```javascript
const budgetService = require('./src/services/budget/budgetService');
```

## ✅ API Documentation Updates

### Update API Docs
If you maintain API documentation, update service references:

```diff
// In API documentation
- Service: `services/budgetService.js`
+ Service: `services/budget/budgetService.js`
```

### Update Architecture Diagrams
Service dependency diagrams should reflect the new structure:

```
services/
├── budget/
│   ├── budgetService.js (main)
│   ├── budgetCalculationService.js
│   ├── projectBudgetService.js
│   └── yearlyBudgetService.js
└── other services...
```

## ✅ Development Environment

### IDE/Editor Updates
Update your IDE workspace settings if you have service-specific configurations:

```json
// In .vscode/settings.json or similar
{
  "files.exclude": {
    "**/services/budgetService.js": false,
    "**/services/budget/budgetService.js": false
  }
}
```

### Search and Replace
Use global search and replace in your editor:

**Search:** `require\(['"]\.\.?/?\.\.?/services/(budget|project|yearly).*Service['"]\)`  
**Replace:** `require('../services/budget/$1Service')`

## ✅ Verification Steps

### 1. Import Test
```bash
cd backend && node -e "
  require('./src/services/budget/budgetService');
  require('./src/services/budget/budgetCalculationService');
  require('./src/services/budget/projectBudgetService');
  require('./src/services/budget/yearlyBudgetService');
  console.log('✅ All imports successful');
"
```

### 2. Route Test
```bash
# If you have a test server
npm start
# Test budget endpoints still work
curl http://localhost:3000/api/budgets/summary
```

### 3. Git Status
```bash
git status
# Should show clean moves, not deletions + additions
```

## ✅ Error Troubleshooting

### Common Import Errors

#### Error: Cannot find module '../budgetService'
```diff
- const budgetService = require('../budgetService');
+ const budgetService = require('../budget/budgetService');
```

#### Error: Cannot find module '../../services/budgetService'
```diff
- const budgetService = require('../../services/budgetService');
+ const budgetService = require('../../services/budget/budgetService');
```

#### Error: Module not found in tests
```diff
- const budgetService = require('../../src/services/budgetService');
+ const budgetService = require('../../src/services/budget/budgetService');
```

### File Not Found Issues
If you get "file not found" errors, verify:

1. File was moved correctly: `ls backend/src/services/budget/`
2. Import path is correct for your file location
3. No typos in the service name

## ✅ New Development Guidelines

### Adding New Budget Services
Place new budget-related services in the budget directory:

```bash
# Create new budget service
touch backend/src/services/budget/newBudgetFeatureService.js
```

### Importing in New Services
```javascript
// From within budget directory
const budgetService = require('./budgetService');

// From outside budget directory
const budgetService = require('./budget/budgetService');
```

### Service Dependencies
Keep budget services cohesive:
- Budget services should import from `./budget/` when possible
- External services import budget services from `./budget/`
- Maintain clean separation of concerns

## ✅ Deployment Checklist

### Before Deploying
- [ ] All imports updated and tested
- [ ] No references to old service paths
- [ ] Tests pass with new import paths
- [ ] API endpoints still functional
- [ ] Documentation updated

### Post-Deployment Verification
- [ ] Services load correctly in production
- [ ] Budget endpoints respond successfully
- [ ] No import-related errors in logs
- [ ] Performance not affected

---

**Created**: 2025-01-22  
**Last Updated**: 2025-01-22  
**Status**: Ready for Use
