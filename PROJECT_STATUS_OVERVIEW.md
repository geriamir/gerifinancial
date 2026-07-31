# GeriFinancial Project Status Overview

**Last Updated**: July 2026
**Verified against**: `main` @ `b6cb52e` (1 April 2026)
**Project Phase**: Multi-Asset Financial Platform — consolidation

---

## Executive Summary

GeriFinancial is a personal financial management platform for the Israeli
market. It aggregates data from banks, credit cards, brokerages, pension
providers and manual inputs into a single net-worth and budgeting view.

Since mid-2025 the project has expanded well beyond its original
transactions + budgets + RSU scope. It now covers **six asset classes** and has
been restructured internally from a layered backend into a **domain-module
architecture** (see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)).

### By the numbers

| Metric | Value |
|---|---|
| Backend API endpoints | 214 across 20 route files |
| Mongoose models | 30 |
| Backend domain modules | 11 + `shared` |
| External sync strategies | 6 |
| Frontend top-level pages | 13 |
| Test files | 47 backend / 15 frontend / 5 Cypress |

---

## Feature Completion Matrix

| Feature System | Status | Notes |
|---|---|---|
| **Transaction Management** | ✅ Production | AI categorisation, tagging, dedup by stable unique ID, exclusions, installment grouping |
| **Bank Integration** | ✅ Production | Israeli bank scrapers, Mercury API, queued sync, OTP flows, scheduling, balance history |
| **Credit Cards** | ✅ Production | Detection, onboarding, per-card stats and trends, foreign-currency handling |
| **Monthly & Yearly Budgets** | ✅ Production | Category budgets, smart calculation, pattern detection, unbudgeted-spend tracking |
| **Project Budgets** | ✅ Production | Multi-source funding, planned/unplanned expenses, transaction discovery, bulk move/tag, deletion |
| **RSU Portfolio** | ✅ Production | Multi-grant tracking, vesting plans, Israeli tax, event-driven timeline |
| **Investments (brokerage)** | ✅ Production | Portfolio sync, IBKR Flex integration, holdings history, cost basis, performance |
| **Pension** | ✅ Production | Phoenix and Clal provider integrations, snapshots, history |
| **Real Estate** | ✅ Production | Investments, installment schedules, rental income, sale handling, transaction linking |
| **Foreign Currency** | ✅ Production | FX accounts, live exchange rates, conversion tooling |
| **Overview Dashboard** | ✅ Production | Net-worth donut, budget status, financial outlook (redesigned Mar 2026) |
| **Onboarding** | ✅ Production | Guided multi-step setup with account discovery and coverage analysis |
| **Options support (IBKR)** | ⚠️ Known gaps | Contract `multiplier` not applied; standalone options mispriced — see open issues |
| **Analytics & Reporting** | 📋 Planned | No export, tax reporting or benchmarking yet |
| **User Profile / Settings** | 📋 Not started | `/profile` route is an inline placeholder in `App.tsx` |

---

## What Shipped Recently

### March–April 2026 — Multi-asset expansion (PRs #31–#65)

This was the most active period in the project's history: 34 merged PRs in
roughly five weeks.

**New asset classes**
- **Investments / IBKR** (#44) — Interactive Brokers Flex Web Service
  integration, holdings timelines, cost basis, per-symbol history
- **Pension** (#55, #58, #59) — Phoenix provider integration with OTP-based
  sync, followed by Clal integration and UI refinement
- **Real Estate** (#61) — investments with installment schedules, rental
  income, sale handling, and linking of real transactions to installments
- **Mercury Bank** (#33) — non-Israeli bank support via direct API

**Budgeting improvements**
- Project default expenses and templates (#41), project deletion (#42),
  transaction discovery for projects (#40), moving unplanned expenses (#36)
- Vacation default-expense fix (#64)
- Salary early-payment attribution (#50)
- Auto-installment detection and grouping (#62)
- Unbudgeted subcategory spend now counted in budget totals

**Data integrity**
- Stable transaction unique IDs (#51) — proper deduplication across scrapes
- Multiple `lastScraped` correctness fixes (#37, #38, #53, #54)
- Scraping look-back window fix (#60)
- Account balance history (#34)

**UI**
- Full UI redesign (#63) followed by the dashboard redesign (#65): net-worth
  donut with per-investment liability breakdown, monthly budget status card
  with deep links, project expenses separated from monthly budget totals
- RTL/currency display fixes standardised on `formatCurrencyDisplay`

### Late 2025 — Foundations for the expansion

- Backend restructured from `models/routes/services` layers into domain modules
- BullMQ + Redis queue system for scraping, with distributed locking
- Server-Sent Events pipeline for live scraping progress
- Onboarding flow restructured
- Credit card details with test coverage (#30)
- Foreign currency and currency conversion enhancements

---

## Known Issues & Technical Debt

### Open GitHub issues

| # | Area | Summary |
|---|---|---|
| [#45](https://github.com/geriamir/gerifinancial/issues/45) | Investments/options | `getHoldingsPriceData` skips option holdings entirely, so options-only portfolios get no price data |
| [#46](https://github.com/geriamir/gerifinancial/issues/46) | Investments/options | `mktValue`/`avgCost` ignore contract `multiplier` (usually 100) |
| [#48](https://github.com/geriamir/gerifinancial/issues/48) | Investments/options | Duplicate of the multiplier problem in a second code path |
| [#49](https://github.com/geriamir/gerifinancial/issues/49) | Investments/options | Standalone options priced off the underlying symbol; wrong timeline fetched |
| [#47](https://github.com/geriamir/gerifinancial/issues/47) | Performance | Expanding a portfolio renders one `HoldingTimelineChart` per position, firing a request each — needs lazy loading |
| [#56](https://github.com/geriamir/gerifinancial/issues/56) | Infrastructure | Pension OTP `pendingSessions` is an in-memory `Map`; breaks across restarts or multiple backend instances |

**Issues #45/#46/#48/#49 are one coherent workstream**: option contracts are
being treated with equity semantics throughout the investments module. Fixing
this properly means introducing option-aware valuation (symbol, multiplier,
timeline source) rather than four separate patches.

### Other debt

- **`/api/budgets` is served by three routers** (`shared`, `monthly-budgets`,
  `project-budgets`). Route ordering in `app.js` is load-bearing and easy to
  break.
- **Root directory clutter** — point-in-time implementation summaries have been
  moved to `docs/archive/`, but new work should not add more root-level
  markdown.
- **No user profile/settings page** — the route renders a placeholder.
- **`israeli-bank-scrapers` is a local path dependency**
  (`file:../../israeli-bank-scrapers`), so a sibling checkout of the
  [`geriamir` fork](https://github.com/geriamir/israeli-bank-scrapers) is
  required to install the backend, and it must be built before real scrapes
  work. The required branch is **`feature/add-foreign-currency`** — the fork's
  `master` is missing `scrapePortfolios`, `scrapeForeignCurrencyAccounts` and
  `generateTransactionUniqueId`, which the investments, foreign-currency and
  dedup code all call. This is an easy setup trap and is now called out in the
  README.
- **Scraper fork divergence** — `feature/add-foreign-currency` is 33 commits
  ahead of the fork's `master`, which is itself 32 behind upstream, so the
  working branch has never been rebased onto current upstream. It also **misses
  the mizrahi transaction-identifier fix** (upstream #1052, present on the
  fork's `feature/add-investments-for-leumi` as `927e1db`) — a candidate
  cherry-pick. Rebasing onto upstream would pick up Puppeteer 24 and
  Node ≥ 22.22.2, so it warrants a scrape smoke-test.
- **Documentation drift** — this refresh (July 2026) corrected roughly eight
  months of drift. Keep architecture docs updated alongside structural changes.
- **CI is event-triggered, not scheduled** — `.github/workflows/test.yml` and
  `e2e-tests.yml` only run on pushes to `main` and pull requests to
  `main`/`develop`. Between April and July 2026 no PR was opened, so nothing ran
  and the time-dependent fixtures below rotted undetected. CI also skips ESLint
  and the production build, which the pre-commit checks in
  `.github/copilot-instructions.md` do cover.
- **Test suites rot between pull requests** — as of this refresh both suites are green
  (backend 873 passing / 47 suites, frontend 205 passing / 15 suites), but
  getting there required fixing bugs that had accumulated unnoticed:
  - Fixtures using hard-coded absolute "future" dates that had since become
    past dates, breaking `unvestedShares` (derived from `vestDate > now`) and
    the `mostRecentTransactionDate` / `lastScraped` future-exclusion logic.
    **Always express test dates relative to `Date.now()`.**
  - 8 of 15 frontend suites could not even load. See the note in
    `frontend/package.json` `jest.moduleNameMapper` — do not remove it.

---

## Suggested Next Priorities

1. **Fix the IBKR options workstream** (#45–#49) — highest-value cluster; the
   investments module currently reports wrong numbers for anyone holding options.
2. **Lazy-load holding timeline charts** (#47) — straightforward performance win.
3. **Move pension OTP sessions to Redis** (#56) — the Redis dependency already
   exists for BullMQ, so this is low-cost and removes a production failure mode.
4. **Analytics & export** — the largest remaining feature gap; tax-year export
   would be especially valuable given the Israeli tax logic already present.
5. **Profile / settings page** — replace the placeholder.

---

## Related Documents

- [`README.md`](README.md) — overview and setup
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the code is organised
- [`CURRENT_CAPABILITIES.md`](CURRENT_CAPABILITIES.md) — user-facing feature guide
- [`docs/archive/`](docs/archive/) — historical implementation notes
