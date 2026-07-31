# GeriFinancial Architecture

**Last verified against code**: `main` @ `b6cb52e` (April 2026)

This document describes how the system is actually laid out today. It is the
reference for where code lives and how the pieces fit together.

---

## 1. High-Level Shape

```
gerifinancial/
├── backend/     Node.js + Express 5 + MongoDB REST API
├── frontend/    React 19 + TypeScript + Material-UI SPA
├── docs/        Architecture, design decisions, archived summaries
└── scripts/     Repo-level dev/test tooling
```

Two independent npm packages, orchestrated from the root `package.json`.
The frontend talks to the backend exclusively over HTTP (`/api/*`) plus one
Server-Sent Events stream for push updates.

### Runtime dependencies

| Component | Purpose | Required |
|---|---|---|
| MongoDB | Primary datastore (Mongoose 8) | Yes |
| Redis | BullMQ job queue + distributed locks | Yes for scraping/sync |
| Puppeteer | Headless browser for `israeli-bank-scrapers` | Yes for bank sync |

### The `israeli-bank-scrapers` dependency

The backend consumes the scraper library from a **local path**, not npm:

```json
"israeli-bank-scrapers": "file:../../israeli-bank-scrapers"
```

That resolves to a sibling of the repository root. The project tracks the fork
[`geriamir/israeli-bank-scrapers`](https://github.com/geriamir/israeli-bank-scrapers);
upstream is [`eshaham/israeli-bank-scrapers`](https://github.com/eshaham/israeli-bank-scrapers).
The package is TypeScript and must be built (`npm run build` → `lib/`) before
real scrapes will work. See the README for setup steps.

**The required checkout is the fork's `feature/add-foreign-currency` branch**,
not `master`. That branch is 33 commits ahead of the fork's `master` and is the
only place the extended scraping API this backend depends on exists:

| API | Consumed by |
|---|---|
| `scrapePortfolios()` / `doesSupportPortfolios()` | `PortfoliosSyncStrategy` |
| `scrapeForeignCurrencyAccounts()` / `doesSupportForeignCurrencyAccounts()` | `ForeignCurrencySyncStrategy` |
| `generateTransactionUniqueId()` | transaction deduplication |

Neither the fork's `master` nor upstream's `master` defines any of them, so the
`investment-portfolios` and `foreign-currency` sync strategies cannot work
against those branches.

Because the dependency is a path, **updating the scrapers is a manual `git pull`
plus rebuild** in that sibling directory — it will never change via
`npm update` here. npm links it as a junction/symlink, so a rebuild in the
sibling checkout takes effect immediately without reinstalling.

---

## 2. Backend: Domain-Module Architecture

The backend is **not** organised by technical layer. There is no top-level
`models/`, `routes/` or `services/` directory. Instead `backend/src/` contains
one folder per business domain, and each domain owns its own models, routes,
services, constants and tests:

```
backend/src/
├── app.js                 Express app: middleware, route mounting, startup wiring
├── server.js              Process entrypoint
│
├── auth/                  Users, registration, JWT login, onboarding status
├── banking/               Bank accounts, transactions, categories, credit cards, scraping
├── foreign-currency/      FX accounts, exchange rates, conversion
├── investments/           Portfolios, holdings, investment transactions, stock prices
├── monthly-budgets/       Monthly/yearly budgets, category budgets, pattern detection
├── onboarding/            First-run setup flow and account discovery
├── pension/               Pension accounts and provider integrations
├── project-budgets/       Project budgets, planned/unplanned expenses, tagging
├── real-estate/           Real-estate investments, installments, rental income
├── rsu/                   RSU grants, sales, vesting, Israeli tax, timeline
├── translation/           Merchant/description translation
│
├── shared/                Cross-cutting infrastructure (see §3)
├── scripts/               One-off migrations and maintenance scripts
├── test/                  Jest setup, mocks, helpers
└── test-scenarios/        Seeded end-to-end scenario fixtures
```

### Standard module layout

```
<module>/
├── models/        Mongoose schemas + an index.js barrel export
├── routes/        Express routers (mounted in app.js)
├── services/      Business logic — the bulk of the code
├── constants/     Enums and shared literals (where applicable)
├── utils/         Module-local helpers (where applicable)
└── __tests__/     Jest tests colocated with the module
```

**Convention**: routes stay thin. They validate input, call a service, and
shape the response. Business logic belongs in `services/`, and cross-module
access goes through the other module's service — not its models directly.

### Module responsibilities

| Module | Key models | Notable services |
|---|---|---|
| `auth` | `User` | — |
| `banking` | `BankAccount`, `Transaction`, `Category`, `SubCategory`, `CreditCard`, `Tag`, `BalanceSnapshot`, `TransactionExclusion`, `ManualCategorized` | `bankScraperService`, `categoryAIService`, `transactionService`, `creditCardService`, `balanceService`, `dataSyncService`, `scrapingSchedulerService`, `ibkrFlexClient`, `mercuryApiClient` |
| `foreign-currency` | `ForeignCurrencyAccount`, `CurrencyExchange` | `currencyExchangeService` |
| `investments` | `Investment`, `Portfolio`, `InvestmentTransaction`, `InvestmentSnapshot`, `PortfolioSnapshot`, `StockPrice` | `investmentService`, `portfolioService`, `investmentSnapshotScheduler` |
| `monthly-budgets` | `MonthlyBudget`, `YearlyBudget`, `CategoryBudget`, `TransactionPattern` | `budgetService`, `budgetCalculationService`, `smartBudgetService`, `patternService`, `recurrenceDetectionService`, `salaryAttributionHelper`, `averagingDenominatorService` |
| `onboarding` | — (uses `banking` models) | `onboardingTransactionService`, `onboardingEventHandlers` |
| `pension` | `PensionAccount`, `PensionSnapshot` | `pensionService`, `phoenixApiClient`, `clalApiClient`, `clalDataMapper` |
| `project-budgets` | `ProjectBudget`, `UnplannedExpense` | `projectBudgetService`, `projectExpensesService`, `projectOverviewService`, `projectTemplateService`, `projectTransactionService`, `unplannedExpenseService` |
| `real-estate` | `RealEstateInvestment` | `realEstateService`, `realEstateTransactionService` |
| `rsu` | `RSUGrant`, `RSUSale` | `rsuService`, `vestingService`, `taxCalculationService`, `stockPriceService`, `timelineService` |
| `translation` | `Translation` | `translationService` |

Total: **30 Mongoose models** across the modules.

---

## 3. Shared Infrastructure (`backend/src/shared/`)

`shared/` holds everything that does not belong to a single domain.

```
shared/
├── config/        Environment + app configuration
├── middleware/    auth (JWT verification), ensureLogsDir
├── routes/        Cross-domain budget aggregation, SSE events, test-only helpers
├── services/      Infrastructure services (below)
└── utils/         logger (Winston), promises, rateLimiter
```

### Credential encryption

Bank credentials are protected with **envelope encryption**. Every user gets
their own randomly generated 32-byte data encryption key (DEK), used with
AES-256-GCM. The DEK is stored on the user document in wrapped form only; the
key encryption key (KEK) that unwraps it is an RSA-2048 key in Azure Key Vault
and never leaves the vault. The container authenticates to the vault with a
user-assigned managed identity holding the **Key Vault Crypto User** role, which
permits wrap and unwrap but not reading, exporting or deleting the key.

This means a database dump alone yields neither credentials nor the keys to
them, a compromise is scoped to a single user rather than every user at once,
and deleting a user destroys their key along with them.

`shared/services/credentialEncryption.js` owns the DEK lifecycle and caches
unwrapped keys in memory for a bounded time so the vault is not called on every
operation. `shared/services/kek/` selects the KEK provider: Azure Key Vault when
`AZURE_KEY_VAULT_URL` is set, otherwise a key derived locally from
`ENCRYPTION_KEY` so development and the test suite run with no cloud dependency.

### `strategyRegistry` — the sync abstraction

Every external data source is implemented as a **sync strategy** registered by
name. The registry is lazily initialised and globally reachable, which avoids a
startup race where BullMQ workers could pick up stale Redis jobs before Mongo
finished connecting.

| Strategy key | Source |
|---|---|
| `checking-accounts` | Israeli banks via `israeli-bank-scrapers` (Puppeteer) |
| `mercury-checking` | Mercury Bank API |
| `investment-portfolios` | Broker portfolios via scraping |
| `ibkr-flex` | Interactive Brokers Flex Web Service (XML) |
| `foreign-currency` | Foreign-currency account balances |
| `phoenix-pension` | Phoenix pension provider API |

**Adding a data source** means adding a strategy under
`<module>/services/sync/` and registering it in `shared/services/strategyRegistry.js`.
Nothing else needs to change — the queue, scheduler and event pipeline are generic.

### `scrapingQueue` — BullMQ producer/consumer

Sync work is queued rather than run inline. Jobs are keyed by
*(strategy, bank account)*, spread across priority queues (e.g. `scraping-high`),
and executed by BullMQ workers backed by Redis. This keeps long Puppeteer runs
off the request path and bounds concurrency against the banks.

Queue health is observable at `GET /api/bank-accounts/queue/stats` and
`/queue/health`.

### `eventBridge` + `sseService` — real-time updates

`eventBridge` decouples producers from consumers of domain events (scraping
progress, onboarding transitions). `sseService` is a generic Server-Sent Events
fan-out: clients subscribe per user, and any subsystem can push events to them
without knowing about HTTP.

The browser connects once to `GET /api/events` and receives scraping progress,
completion and error notifications live.

### `distributedLock`

Redis-backed mutual exclusion, so a scheduled job cannot run twice concurrently
across processes or restarts.

---

## 4. API Surface

**214 endpoints** across 20 route files. Mounted in `backend/src/app.js`:

| Mount point | Router | Endpoints |
|---|---|---|
| `/api/auth` | `auth/routes/auth.js` | 4 |
| `/api/users` | `auth/routes/users.js` | 2 |
| `/api/bank-accounts` | `banking/routes/bankAccounts.js` | 15 |
| `/api/credit-cards` | `banking/routes/creditCards.js` | 6 |
| `/api/transactions` | `banking/routes/transactions.js` | 16 |
| `/api/budgets` | `shared/routes/budgets.js` | 6 |
| `/api/budgets` | `monthly-budgets/routes/budgets.js` | 9 |
| `/api/budgets` | `project-budgets/routes/budgets.js` | 15 |
| `/api/budgets/patterns` | `monthly-budgets/routes/patterns.js` | 8 |
| `/api/category-budgets` | `monthly-budgets/routes/categoryBudgets.js` | 10 |
| `/api/rsus` | `rsu/routes/rsus.js` | 31 |
| `/api/investments` | `investments/routes/investments.js` | 23 |
| `/api/portfolios` | `investments/routes/portfolios.js` | 10 |
| `/api/foreign-currency` | `foreign-currency/routes/foreignCurrency.js` | 10 |
| `/api/onboarding` | `onboarding/routes/onboarding.js` + `onboardingAccounts.js` | 16 |
| `/api/pension` | `pension/routes/pension.js` | 8 |
| `/api/real-estate` | `real-estate/routes/realEstate.js` | 20 |
| `/api/events` | `shared/routes/events.js` | 2 |
| `/api/test` | `shared/routes/test.js` | 4 (non-production only) |

Note that `/api/budgets` is served by **three** routers — the shared aggregation
router, the monthly-budget router and the project-budget router. Ordering in
`app.js` matters when adding paths there.

All routes except `/api/auth/github/*` and `/api/test/*` require a session via
the `shared/middleware/auth.js` middleware. The middleware accepts either the
`gerifinancial_session` httpOnly cookie or an `Authorization: Bearer` header.

### Sign-in

There is no registration endpoint and no password anywhere in the system.
Sign-in is delegated to a GitHub OAuth App:

1. `GET /api/auth/github/login` redirects to GitHub, carrying a signed,
   time-limited `state` that also encodes where to return the user to.
2. `GET /api/auth/github/callback` verifies `state` *before* looking at `code`,
   exchanges the code for an access token, reads the GitHub profile, and
   upserts the local user by **numeric GitHub id** — logins and emails can be
   changed and later claimed by someone else, the id cannot.
3. A session JWT is signed locally and set as an httpOnly cookie, so an XSS
   payload cannot read it.

`safeReturnTo` restricts the post-sign-in redirect to the `CORS_ORIGIN`
allowlist, so the callback cannot be turned into an open redirect.

---

## 5. Frontend

```
frontend/src/
├── App.tsx          Router + provider composition
├── theme.ts         Material-UI theme
├── pages/           One component per top-level route
├── components/      Feature-grouped component library
├── contexts/        React context providers (auth, app state)
├── hooks/           Reusable hooks
├── services/api/    Typed API clients, one per backend domain
├── types/           Shared TypeScript interfaces
├── utils/           Formatting and helpers
└── constants/       Shared literals
```

### Pages and routes

| Route | Page |
|---|---|
| `/` | `Overview.tsx` — dashboard: net worth, budget status, financial outlook |
| `/transactions` | `Transactions.tsx` |
| `/budgets` | `Budgets.tsx` |
| `/budgets/subcategory/:year/:month/:categoryId/:subcategoryId` | `BudgetSubcategoryDetail.tsx` |
| `/budgets/income/:year/:month/:categoryId` | `BudgetSubcategoryDetail.tsx` |
| `/rsus` | `RSUs.tsx` |
| `/investments` | `Investments.tsx` |
| `/pension` | `Pension.tsx` |
| `/real-estate`, `/real-estate/:investmentId` | `RealEstate.tsx` |
| `/projects`, `/projects/:projectId` | `Projects.tsx` |
| `/foreign-currency` (+ account/convert sub-routes) | `ForeignCurrency.tsx` |
| `/banks` | `Banks.tsx` |
| `/profile` | Inline placeholder in `App.tsx` — **not yet implemented** |
| `/onboarding` | `Onboarding.tsx` (outside the main layout) |
| `/login` | `LoginForm.tsx` — a single "Continue with GitHub" link (public) |

Everything except the auth and onboarding routes renders inside a protected
layout shell that provides navigation. `OnboardingGuard` redirects users who
have not completed setup.

### Contexts

State is held in React contexts composed in `App.tsx`, in this order:
`ThemeContextProvider` → `LocalizationProvider` (date-fns, Hebrew locale) →
`AuthProvider` → `BudgetProvider` / `RSUProvider` / `InvestmentProvider` /
`ProjectProvider`.

### Component groups

`auth`, `bank`, `budget`, `common`, `dashboard`, `dev`, `foreign-currency`,
`investment`, `investments`, `layout`, `onboarding`, `overview`, `performance`,
`project`, `projects`, `realEstate`, `rsu`, `transactions`.

### Key libraries

React 19, TypeScript, Material-UI 7 (`@mui/material`, `@mui/x-date-pickers`,
`@mui/x-tree-view`), React Router 7, Recharts 3 (all charting), Axios, Formik +
Yup (forms/validation), date-fns, `@dnd-kit` (drag-and-drop ordering), Sentry
(error reporting).

---

## 6. Cross-Cutting Concerns

### Currency

The app is multi-currency with **ILS as the display base**. Amounts carry their
original currency, and conversion happens through `currencyExchangeService`,
which handles both `ILS → X` and `X → ILS` rate directions. UI code must use the
shared `formatCurrencyDisplay` helper — Hebrew-locale formatting injects RTL
marks that break number alignment, so currency values are rendered with explicit
LTR direction.

### Transaction identity and deduplication

Transactions carry a stable unique identifier so repeated scrapes converge
rather than duplicate. Scraping uses an incremental look-back window instead of
refetching full history. See
[`TRANSACTION_DEDUPLICATION_STRATEGY.md`](TRANSACTION_DEDUPLICATION_STRATEGY.md).

### Categorisation

Transactions are categorised by `categoryAIService` using keyword matching with
word-boundary detection plus `natural` and `string-similarity`. Confidence is
scored, and manual overrides are recorded in `ManualCategorized` so the system
learns per-user corrections.

### Tagging

`Tag` is the shared mechanism linking transactions to projects and real-estate
investments. Tags are ObjectId-based; project and real-estate budgets create and
own their tags, and expense attribution flows through them.

---

## 7. Development Workflow

```bash
npm run install-all     # install backend + frontend deps
npm run dev             # start MongoDB/Redis services + both apps concurrently
npm run kill-ports      # free ports 3000/3001
```

Backend runs on 3001, frontend on 3000.

### Tests

```bash
cd backend  && npm test                          # Jest, --runInBand
cd frontend && npm test -- --watchAll=false      # React Testing Library
npm run test:e2e                                 # Cypress
```

Current suite: 47 backend test files, 15 frontend test files, 5 Cypress specs.
Backend tests run serially (`--runInBand`) because they share a test database.

#### Test gotchas

**Never hard-code absolute dates in fixtures.** Several behaviours key off
"is this date in the future?" — notably `RSUGrant.unvestedShares` (a virtual
derived from `vestDate > now`, *not* from the `vested` flag) and the
`mostRecentTransactionDate` / `lastScraped` logic that deliberately ignores
future-dated instalments. Fixtures written with literal dates pass until real
time overtakes them, then fail for reasons unrelated to the code under test.
Express test dates relative to `Date.now()` instead.

**`frontend/package.json` defines `jest.moduleNameMapper` — do not remove it.**
`react-scripts` 5 ships a Jest resolver that predates the `exports` field, so it
falls back to `main`. Two dependencies break under that resolver:

| Package | Problem | Mapped to |
|---|---|---|
| `react-router-dom` | Declares `main: ./dist/main.js`, a file it does not ship | `react-router-dom/dist/index.js` |
| `react-router` | Subpath `react-router/dom` is `exports`-only | `react-router/dist/development/dom-export.js` |
| `axios` | Resolves to its ESM entry under the jsdom `browser` condition | `axios/dist/node/axios.cjs` |

Webpack understands `exports`, so `npm run build` succeeds even when these
suites cannot load — a green build is not evidence that tests run.

**Globals in `src/setupTests.ts` must be plain functions, not `jest.fn()`.**
`react-scripts` sets `resetMocks: true`, which clears mock implementations
before every test. `window.matchMedia` and `window.ResizeObserver` are stubbed
there; as `jest.fn().mockImplementation(...)` they would be reset to return
`undefined`, and MUI's `useMediaQuery` then throws
`Cannot read properties of undefined (reading 'matches')`.

### Required pre-commit checks

Per `.github/copilot-instructions.md`, all of the following must pass before
committing:

1. `cd backend && npm run test`
2. `cd frontend && npm run test -- --watchAll=false`
3. `cd frontend && npx eslint src/ --max-warnings 0`
4. `cd frontend && npx tsc --noEmit`
5. `cd frontend && npm run build`

> CI covers only part of this list: `.github/workflows/test.yml` runs the
> frontend and backend unit tests plus `tsc --noEmit`, and `e2e-tests.yml` runs
> the Cypress suite, both on pull requests to `main`/`develop`. Neither runs
> ESLint or the production build, so run the full list locally before committing.

### Branching

Always branch from an up-to-date `main`:

```bash
git checkout main && git pull origin main && git checkout -b feature/<name>
```

---

## 8. Related Documents

- [`../README.md`](../README.md) — project overview and setup
- [`../PROJECT_STATUS_OVERVIEW.md`](../PROJECT_STATUS_OVERVIEW.md) — feature status and roadmap
- [`../CURRENT_CAPABILITIES.md`](../CURRENT_CAPABILITIES.md) — what users can do today
- [`navigation/DESIGN_DECISIONS.md`](navigation/DESIGN_DECISIONS.md) — navigation rationale
- [`archive/README.md`](archive/README.md) — historical implementation notes
