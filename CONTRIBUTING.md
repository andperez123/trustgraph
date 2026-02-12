# Contributing to TrustGraph

Thanks for your interest in TrustGraph. This guide helps you run the project locally and contribute.

## Prerequisites

- **Node.js** ≥ 20
- **PostgreSQL** (for DB, migrate, e2e tests)

## Setup

```bash
# 1. Clone and install
git clone https://github.com/andperez123/trustgraph.git
cd trustgraph
npm install

# 2. Copy env template and set DATABASE_URL
cp .env.example .env
# Edit .env with your PostgreSQL connection string

# 3. Run schema migration
npm run db:migrate

# 4. Build (optional, for production)
npm run build
```

## Running locally

| Command | Description |
|---------|-------------|
| `npm run dev:api` | Start REST API (port 3040) |
| `npm run dev:mcp` | Start MCP server (stdio) |
| `npm run job:scores` | Recompute all trust scores (cron) |

## Tests

```bash
# Unit tests (no DB required)
npm test

# E2E tests (requires DATABASE_URL)
DATABASE_URL=postgresql://... npm run test -- e2e
```

E2E tests are skipped automatically when `DATABASE_URL` is not set.

## Conventions

- **TypeScript** — strict mode, ESM modules
- **Tests** — add unit tests for new scoring logic; e2e for integration flows
- **Docs** — update `docs/` and README when adding APIs or env vars

## Project structure

- `src/api/` — REST routes (trust, public viral surfaces)
- `src/mcp/` — MCP server and tools
- `src/events/` — event ingest
- `src/scoring/` — trust score engine
- `src/services/` — trust-read, leaderboard, card
- `src/integrations/` — Taskmint, WakeNet event builders
- `docs/` — MCP, integrations

## Questions?

Open an issue on GitHub.
