# Copilot Agent Instructions

## Pre-Commit Checks

Before every git commit, run the following checks and ensure they all pass:

1. **Backend tests:** `cd backend && npm run test`
2. **Frontend tests:** `cd frontend && npm run test -- --watchAll=false`
3. **Frontend build (formatting/type check):** `cd frontend && npm run build`

Do not commit if any of these checks fail. Fix the issues first, then re-run.
