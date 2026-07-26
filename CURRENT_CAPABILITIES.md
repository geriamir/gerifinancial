# GeriFinancial — Current Capabilities

**Last Updated**: July 2026
**Verified against**: `main` @ `b6cb52e`

A user-facing guide to what the application can do today. For architecture see
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md); for project status see
[`PROJECT_STATUS_OVERVIEW.md`](PROJECT_STATUS_OVERVIEW.md).

---

## Overview

GeriFinancial consolidates your entire financial picture into one place:
bank accounts, credit cards, brokerage portfolios, RSU grants, pension savings,
real-estate investments and foreign-currency holdings — all rolled up into a
single net-worth view with budgeting on top.

The application has thirteen main areas:

| Area | Route | Purpose |
|---|---|---|
| Overview | `/` | Net worth, budget status, financial outlook |
| Transactions | `/transactions` | Browse, categorise, tag, filter |
| Budgets | `/budgets` | Monthly and yearly budgeting |
| Projects | `/projects` | One-off project budgets (renovations, trips) |
| RSUs | `/rsus` | Stock grant and vesting management |
| Investments | `/investments` | Brokerage portfolios and holdings |
| Pension | `/pension` | Pension accounts and growth |
| Real Estate | `/real-estate` | Property investments |
| Foreign Currency | `/foreign-currency` | FX accounts and conversion |
| Banks | `/banks` | Connections and sync management |

---

## Overview Dashboard

The landing page answers "how am I doing?" at a glance.

- **Net-worth donut** — a two-ring breakdown of every asset you hold: bank
  balances, investment portfolios and cash, RSU value, pension savings,
  real-estate equity and foreign-currency accounts. Liabilities are broken out
  per real-estate project rather than lumped together.
- **Click-through everywhere** — clicking any slice navigates to that asset's
  detail page. Liability slices open the relevant real-estate project.
- **Original currency preserved** — non-ILS holdings show their native amount
  in the tooltip alongside the ILS-converted value.
- **Monthly budget status** — income vs expenses for the current month, top
  spending categories, and a separate box for project expenses so one-off
  spending does not distort your monthly picture.
- **Financial outlook** — forward-looking view combining upcoming vesting,
  scheduled installments and expected income.
- **Action items** — uncategorised transactions and stale bank connections
  surfaced with direct links.

---

## Bank & Credit Card Integration

### Connecting accounts
- Connect Israeli bank accounts via the `israeli-bank-scrapers` integration.
- Connect **Mercury Bank** accounts through its direct API.
- Credentials are encrypted at rest and never returned in API responses.
- Test a connection before saving it.

### Syncing
- Sync runs through a **background job queue** — long scrapes never block the UI.
- **Live progress** streams to the browser, so you can watch a sync run and see
  errors as they happen.
- Automatic scheduling keeps accounts fresh; you can also trigger a sync for one
  account or all accounts on demand.
- Incremental look-back rather than full-history refetch.
- **Stable transaction IDs** mean re-syncing never creates duplicates.
- Recover missing transactions for an account when a scrape was incomplete.

### Credit cards
- Cards are detected automatically from your transaction history during
  onboarding.
- Per-card statistics, monthly breakdowns and spending trends.
- Foreign-currency card charges are handled with correct conversion.
- Card payments are matched against the corresponding checking-account debits so
  spending is not double-counted.

### Balances
- Account balance history over time.
- Consolidated balance summary and net-worth calculation.

---

## Transaction Management

- **Automatic categorisation** — transactions are categorised on import using
  keyword matching with word-boundary detection and similarity scoring, with a
  confidence score attached.
- **Manual override** — recategorise anything; your corrections are remembered
  and applied to similar future transactions.
- **Custom categories** — create categories and subcategories, and edit the
  keywords that drive automatic matching.
- **Tagging** — tag transactions to attribute them to projects or real-estate
  investments.
- **Exclusions** — exclude specific transactions from budget calculations.
- **Installment grouping** — multi-payment purchases are detected and grouped
  automatically rather than appearing as unrelated monthly charges.
- **Filtering and search** across date, amount, category, account and text.
- **Uncategorised queue** — a dedicated view and stats endpoint so nothing slips
  through.

---

## Budgets

### Monthly & yearly
- Build budgets at **subcategory** precision.
- **Smart calculation** — generate a budget automatically from your historical
  spending, with sensible averaging that accounts for months where a category
  had no activity.
- Track budget vs actual in real time, with variance highlighted.
- **Unbudgeted spend is still counted** — categories you never budgeted for
  appear with their actual spend so totals are honest.
- Drill down from any category into the transactions behind the number.
- Yearly budget view for annual planning.
- **Salary early-payment handling** — a salary paid at the end of the prior
  month is attributed to the month it is intended for.

### Pattern detection
- Recurring expenses (bi-monthly, quarterly, yearly) are detected
  automatically.
- Review detected patterns and approve, reject or bulk-approve them.
- Preview how approved patterns will affect a given month before committing.

### Project budgets
- Create budgets for discrete projects — a renovation, a wedding, a trip.
- **Multiple funding sources** per project, including funding from ongoing
  income or from savings.
- **Default expense templates** so common project types start pre-populated.
- **Transaction discovery** — the app suggests existing transactions that likely
  belong to a project.
- Tag transactions individually or in bulk; move or unassign them between
  projects.
- **Unplanned expenses** are tracked separately from planned ones.
- Expense breakdown per project, and project spending is kept out of your
  regular monthly budget totals.

---

## RSU Portfolio

- Track unlimited grants across multiple companies.
- **Vesting plans** — quarterly vesting over configurable periods, with
  remainder shares distributed evenly; preview a plan before applying it.
- **Upcoming vesting** list and a vesting calendar.
- **Israeli tax calculations** — wage income vs capital gains treatment,
  including the two-year holding threshold.
- **Tax preview** before recording a sale, plus tax projections and per-year
  summaries.
- Record sales with automatic tax computation.
- **Event-driven timeline** — portfolio value over time computed from actual
  historical prices at each event, not today's price applied retroactively.
- Stock prices fetched from multiple providers with fallback, cached per date,
  including on-demand historical backfill.
- Per-grant and whole-portfolio performance analysis.

---

## Investments (Brokerage)

- **Portfolio sync** from connected brokerage accounts.
- **Interactive Brokers Flex** integration for positions and activity.
- Holdings with quantity, cost basis and market value.
- **Cost basis and realised/unrealised gains** per symbol.
- Holding history and per-symbol timelines.
- Investment transactions (buys, sells, dividends) with summaries.
- Portfolio performance metrics and trend history.
- Point-in-time portfolio snapshots, captured on a schedule.
- Cash balances tracked per portfolio and included in net worth.

> **Known limitation**: options positions are currently valued using equity
> semantics — contract multipliers are not applied, and options held without the
> underlying stock are priced against the underlying symbol. See issues
> [#45](https://github.com/geriamir/gerifinancial/issues/45),
> [#46](https://github.com/geriamir/gerifinancial/issues/46),
> [#48](https://github.com/geriamir/gerifinancial/issues/48) and
> [#49](https://github.com/geriamir/gerifinancial/issues/49).

---

## Pension

- Connect **Phoenix** and **Clal** pension providers.
- OTP-based authentication flow for provider sync.
- Multiple products per provider, mapped to product types.
- **Snapshots over time** so you can see pension growth, not just the current
  balance.
- Full history view, and pension value is included in net worth.

---

## Real Estate

- Track property investments with purchase details and current valuation.
- **Installment schedules** — payment plans with individual installments you can
  add, edit and remove.
- **Link real transactions to installments** so planned payments reconcile
  against what actually left your account.
- **Rental income** tracking per property.
- **Sale handling** — record a sale and have the investment settle correctly.
- Link a property to a dedicated bank account.
- Tag transactions to a property individually or in bulk.
- Outstanding commitments appear as per-property liabilities in the net-worth
  breakdown.

---

## Foreign Currency

- Track foreign-currency accounts and balances.
- **Live exchange rates** with manual refresh, supporting both `ILS → X` and
  `X → ILS` directions.
- Currency conversion tool.
- Per-account transaction history.
- Summary view across all foreign holdings, converted to ILS.

---

## Onboarding

A guided first-run flow:

1. Connect your primary checking account.
2. The app scrapes initial history and shows live import progress.
3. **Credit cards are detected automatically** from that history.
4. Confirm the detected cards, or skip the step.
5. Card payments are matched against checking-account debits.
6. **Coverage analysis** tells you whether your connected accounts explain your
   spending, or whether something is missing.

---

## Getting Started

1. **Connect a bank account** (~5 min) — go to `/banks` and add your primary
   checking account. Let the initial sync complete.
2. **Review credit card detection** (~5 min) — confirm the cards the app found.
3. **Categorise transactions** (~10 min) — work through the uncategorised queue
   on `/transactions`. Corrections here train future categorisation.
4. **Generate a budget** (~10 min) — on `/budgets`, use smart calculation to
   build one from your history, then adjust.
5. **Review detected patterns** (~5 min) — approve the recurring expenses the
   app found.
6. **Add other assets** — RSU grants, brokerage connections, pension providers,
   real-estate investments.
7. **Check the Overview** — your net worth and budget status are now live.

---

## Not Yet Available

- Data export and tax-year reporting
- Advanced analytics and benchmarking
- User profile / settings page (`/profile` is a placeholder)
- Multi-user or shared household accounts
- Native mobile app (the web app is mobile-responsive)
