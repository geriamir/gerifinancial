# Copilot Agent Instructions

## Pre-Commit Checks

Before every git commit, run the following checks and ensure they all pass:

1. **Backend tests:** `cd backend && npm run test`
2. **Frontend tests:** `cd frontend && npm run test -- --watchAll=false`
3. **Frontend lint:** `cd frontend && npx eslint src/ --max-warnings 0`
4. **Frontend build:** `cd frontend && npm run build`

Do not commit if any of these checks fail. Fix the issues first, then re-run.

## New Feature Branches

Before creating a new feature branch, always:

1. `git checkout main`
2. `git pull origin main`
3. Then create the branch from the up-to-date main: `git checkout -b feature/<name>`
