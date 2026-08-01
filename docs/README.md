# Documentation

## Start Here

| Document | Purpose |
|---|---|
| [`../README.md`](../README.md) | Project overview, setup and scripts |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | How the codebase is organised — read this first when changing code |
| [`../CURRENT_CAPABILITIES.md`](../CURRENT_CAPABILITIES.md) | User-facing guide to what the app can do |
| [`../PROJECT_STATUS_OVERVIEW.md`](../PROJECT_STATUS_OVERVIEW.md) | Feature status, known issues, next priorities |

## Operations & Setup

| Document | Purpose |
|---|---|
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Deploying to Azure, key vaults and secret rotation |
| [`DOCKER_MONGODB_SETUP.md`](DOCKER_MONGODB_SETUP.md) | Running MongoDB via Docker |
| [`QUEUE_SYSTEM_SETUP.md`](QUEUE_SYSTEM_SETUP.md) | BullMQ + Redis scraping queue setup |
| [`BACKUP_PROCEDURES.md`](BACKUP_PROCEDURES.md) | Database backup and restore |

## Subsystem Reference

| Document | Purpose |
|---|---|
| [`ONBOARDING_SYSTEM_README.md`](ONBOARDING_SYSTEM_README.md) | Onboarding flow overview |
| [`ONBOARDING_TECHNICAL_ARCHITECTURE.md`](ONBOARDING_TECHNICAL_ARCHITECTURE.md) | Onboarding internals |
| [`ONBOARDING_API_DOCUMENTATION.md`](ONBOARDING_API_DOCUMENTATION.md) | Onboarding API reference |
| [`TRANSACTION_DEDUPLICATION_STRATEGY.md`](TRANSACTION_DEDUPLICATION_STRATEGY.md) | How duplicate transactions are prevented |
| [`navigation/DESIGN_DECISIONS.md`](navigation/DESIGN_DECISIONS.md) | Navigation design rationale |

## Planning

| Document | Purpose |
|---|---|
| [`TESTING_ROADMAP.md`](TESTING_ROADMAP.md) | Testing strategy and coverage goals |
| [`FUTURE_INTEGRATION_FEATURES.md`](FUTURE_INTEGRATION_FEATURES.md) | Candidate future integrations |

## Archive

[`archive/`](archive/) holds completed roadmaps and point-in-time implementation
summaries. They are historical context only — several reference the pre-2026
backend layout and are no longer accurate.

---

## Conventions

- **Keep the repository root clean.** Only `README.md`,
  `CURRENT_CAPABILITIES.md` and `PROJECT_STATUS_OVERVIEW.md` belong there.
- **Architecture and reference docs** go in `docs/`.
- **Point-in-time summaries** ("we fixed X", "phase N complete") go straight to
  `docs/archive/` — or better, into the pull request description rather than a
  committed file.
- **Update [`ARCHITECTURE.md`](ARCHITECTURE.md) in the same PR** as any change to
  module layout, shared infrastructure or the route map.
