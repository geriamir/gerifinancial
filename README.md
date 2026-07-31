# GeriFinancial

A personal financial management platform for the Israeli market. It aggregates
bank accounts, credit cards, brokerage portfolios, RSU grants, pension savings,
real-estate investments and foreign-currency holdings into a single net-worth
view, with budgeting and automated transaction categorisation on top.

**Docs**
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the code is organised
- [`CURRENT_CAPABILITIES.md`](CURRENT_CAPABILITIES.md) — what the app can do today
- [`PROJECT_STATUS_OVERVIEW.md`](PROJECT_STATUS_OVERVIEW.md) — status, known issues, priorities

---

## Features

| Area | Summary |
|---|---|
| **Banking** | Israeli bank scrapers + Mercury API, queued background sync, live progress via SSE, incremental scraping with stable transaction IDs |
| **Credit cards** | Automatic detection, per-card stats and trends, payment matching, foreign-currency charges |
| **Transactions** | Automatic categorisation with confidence scoring, manual overrides that train the matcher, tagging, exclusions, installment grouping |
| **Budgets** | Monthly/yearly budgets at subcategory precision, smart calculation from history, recurring-pattern detection, unbudgeted-spend tracking |
| **Projects** | Project budgets with multi-source funding, templates, transaction discovery, planned vs unplanned expenses |
| **RSUs** | Multi-grant tracking, vesting plans, Israeli tax calculation, event-driven historical timeline |
| **Investments** | Brokerage portfolio sync, Interactive Brokers Flex integration, cost basis, holdings history, performance |
| **Pension** | Phoenix and Clal provider integrations with snapshot history |
| **Real estate** | Properties with installment schedules, rental income, sale handling, transaction linking |
| **Foreign currency** | FX accounts, live rates, conversion tooling |

---

## Tech Stack

**Backend** — Node.js, Express 5, MongoDB (Mongoose 8), BullMQ + Redis for job
queuing, Puppeteer via `israeli-bank-scrapers`, JWT auth with bcrypt, Winston
logging, `natural` + `string-similarity` for categorisation, node-cron for
scheduling.

**Frontend** — React 19, TypeScript, Material-UI 7, React Router 7, Recharts 3,
Axios, Formik + Yup, date-fns, `@dnd-kit`, Sentry.

**Testing** — Jest (backend), React Testing Library (frontend), Cypress (E2E).

---

## Project Structure

```
gerifinancial/
├── backend/
│   └── src/
│       ├── app.js               Express app, route mounting, startup wiring
│       ├── server.js            Process entrypoint
│       │
│       ├── auth/                Users, JWT login, onboarding status
│       ├── banking/             Accounts, transactions, categories, cards, scraping
│       ├── foreign-currency/    FX accounts, exchange rates
│       ├── investments/         Portfolios, holdings, stock prices
│       ├── monthly-budgets/     Monthly/yearly budgets, pattern detection
│       ├── onboarding/          First-run setup flow
│       ├── pension/             Pension accounts and providers
│       ├── project-budgets/     Project budgets and expenses
│       ├── real-estate/         Property investments
│       ├── rsu/                 Grants, vesting, tax, timeline
│       ├── translation/         Merchant description translation
│       │
│       ├── shared/              Config, middleware, queue, events, SSE, utils
│       ├── scripts/             Migrations and maintenance
│       └── test/                Jest setup, mocks, helpers
│
├── frontend/
│   ├── cypress/                 E2E specs
│   └── src/
│       ├── pages/               One component per top-level route
│       ├── components/          Feature-grouped component library
│       ├── contexts/            Auth, Budget, RSU, Investment, Project, Theme
│       ├── hooks/               Reusable hooks
│       ├── services/api/        Typed API clients per backend domain
│       ├── types/               Shared TypeScript interfaces
│       └── utils/               Formatting and helpers
│
├── docs/                        Architecture, design decisions, archive
└── scripts/                     Repo-level dev/test tooling
```

The backend is organised **by business domain**, not by technical layer — each
module owns its own models, routes, services and tests. See
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full picture, including
the sync-strategy registry, job queue and event pipeline.

The API exposes **214 endpoints** across 20 route files, backed by 30 Mongoose
models.

---

## Prerequisites

- **Node.js ≥ 22.12** and npm
- **MongoDB** running on port 27777 (or set `MONGODB_URI`)
- **Redis** — required for the BullMQ scraping queue and distributed locks
- **`israeli-bank-scrapers`** cloned as a **sibling of this repository**, on the
  `feature/add-foreign-currency` branch — see below

### Setting up `israeli-bank-scrapers`

The backend depends on the scraper library through a local path
(`"israeli-bank-scrapers": "file:../../israeli-bank-scrapers"`), so
`npm install` fails unless the directory exists next to this repo:

```
repos/
├── gerifinancial/
└── israeli-bank-scrapers/     <-- must be here
```

The project uses the fork at
[`geriamir/israeli-bank-scrapers`](https://github.com/geriamir/israeli-bank-scrapers)
(the upstream package is marked `private`, so it is consumed from source rather
than npm). It is a TypeScript package whose `main` is `lib/index.js`, and `lib/`
is **not** committed — you must build it before the backend can run:

```bash
cd ..                                   # into the parent of gerifinancial/
git clone https://github.com/geriamir/israeli-bank-scrapers.git
cd israeli-bank-scrapers
git remote add upstream https://github.com/eshaham/israeli-bank-scrapers.git
git checkout feature/add-foreign-currency   # REQUIRED — see below
npm install
npm run build                           # emits lib/
```

> ⚠️ **Check out `feature/add-foreign-currency`, not the default branch.**
> Three APIs this backend calls exist *only* on that branch — they are absent
> from both the fork's `master` and upstream's `master`:
>
> | API | Used by |
> |---|---|
> | `scrapePortfolios()` / `doesSupportPortfolios()` | `investments/services/sync/PortfoliosSyncStrategy.js` |
> | `scrapeForeignCurrencyAccounts()` / `doesSupportForeignCurrencyAccounts()` | `foreign-currency/services/sync/ForeignCurrencySyncStrategy.js` |
> | `generateTransactionUniqueId()` | transaction deduplication (PRs #51, #53) |
>
> On `master` the backend installs and boots fine, but the investment and
> foreign-currency sync strategies fail at runtime, and transaction dedup falls
> back to the non-unique bank `identifier`.

Backend *tests* do not need the built library: `bankScraperService.js`
substitutes `src/test/mocks/bankScraper` whenever `NODE_ENV` is `test` or `e2e`.
The build is only required to run real scrapes.

---

## Setup

```bash
# 1. Install dependencies for both apps
npm run install-all

# 2. Configure the backend environment
cp backend/.env.example backend/.env
# then edit backend/.env — at minimum set JWT_SECRET and ENCRYPTION_KEY

# 3. Start MongoDB + Redis and both dev servers
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- MongoDB: localhost:27777

`npm run dev` attempts to start local MongoDB and Memurai (Redis) Windows
services first. On other platforms, start those services yourself and run
`npm run backend` and `npm run frontend` separately.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | no | Backend port (default 3001) |
| `MONGODB_URI` | yes | MongoDB connection string |
| `JWT_SECRET` | yes | Token signing secret |
| `JWT_EXPIRATION` | no | Token lifetime (default 24h) |
| `ENCRYPTION_KEY` | yes, unless `AZURE_KEY_VAULT_URL` is set | Wraps each user's bank-credential key when running without Key Vault |
| `AZURE_KEY_VAULT_URL` | no | Key Vault holding the key encryption key. Takes precedence over `ENCRYPTION_KEY` |
| `AZURE_KEY_VAULT_KEY_NAME` | no | Key name within the vault (default `credential-kek`) |
| `AZURE_CLIENT_ID` | no | User-assigned managed identity to authenticate to Key Vault with |
| `DEK_CACHE_TTL_MS` | no | How long an unwrapped user key is cached in memory (default 15 min) |
| `NODE_ENV` | no | `development` / `test` / `production` |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` / `REDIS_DB` | no | Redis connection (defaults to localhost:6379) |
| `ALPHA_VANTAGE_API_KEY`, `FINNHUB_API_KEY` | no | Stock price providers |
| `CURRENCY_API_KEY`, `FIXER_API_KEY` | no | Exchange rate providers |

---

## Scripts

### Root

```bash
npm run install-all     # Install backend + frontend dependencies
npm run dev             # Start local services + both dev servers
npm run backend         # Backend only
npm run frontend        # Frontend only
npm run kill-ports      # Free ports 3000 and 3001
npm run test            # Backend + frontend unit tests
npm run test:e2e        # Cypress E2E suite (CI runner)
npm run test:all        # Unit tests followed by E2E
npm run cypress:open    # Open the Cypress UI
npm run debugscrape     # Run dev servers with scraper debug logging
```

### Backend

```bash
cd backend
npm run dev             # nodemon
npm start               # production start
npm test                # Jest, serial (--runInBand)
npm run test:watch
```

Migration scripts live in `backend/src/scripts/` and are exposed as
`npm run migrate:*` targets; the destructive ones support `--dry-run` and
`--rollback`.

### Frontend

```bash
cd frontend
npm start                       # dev server
npm run build                   # production build
npm test                        # Jest + React Testing Library
npm run cypress:open            # interactive E2E
npm run cypress:run             # headless E2E
npm run test:e2e:headless       # start server + headless E2E
```

---

## Testing

Current suite: **47 backend test files, 15 frontend test files, 5 Cypress
specs**. Backend tests run serially because they share a test database.

### Required pre-commit checks

All of the following must pass before committing (see
[`.github/copilot-instructions.md`](.github/copilot-instructions.md)):

```bash
cd backend  && npm run test
cd frontend && npm run test -- --watchAll=false
cd frontend && npx eslint src/ --max-warnings 0
cd frontend && npx tsc --noEmit
cd frontend && npm run build
```

> **CI covers only part of this list.** `.github/workflows/test.yml` runs the
> frontend and backend unit tests plus `tsc --noEmit`, and `e2e-tests.yml` runs
> the Cypress suite — both on pull requests to `main`/`develop`. Neither runs
> ESLint or the production build, so run the full list locally before committing.

---

## Contributing

Branch from an up-to-date `main`:

```bash
git checkout main
git pull origin main
git checkout -b feature/<name>
```

Run the pre-commit checks above, then open a pull request.

**Documentation convention**: keep the root directory clean. Architecture and
design docs belong in `docs/`; point-in-time implementation summaries belong in
`docs/archive/`. Update [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) in the
same PR as any structural change.

---

## License

ISC
