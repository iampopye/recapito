# Rio Mailer

White-label unified inbox platform. NestJS API + Next.js frontend + IMAP sync daemon, delivered as a Docker-based stack.

## Tech stack

- **Backend:** NestJS 10, TypeORM, PostgreSQL 16, Passport JWT
- **Frontend:** Next.js 14 (App Router), React 18, Tailwind CSS
- **IMAP daemon:** Node.js + `imapflow` + `mailparser`
- **Outbound email:** Mailgun (with optional SMTP fallback)
- **Infra:** Docker Compose, nginx, Let's Encrypt
- **Monorepo:** pnpm workspaces

## Repository layout

```
apps/
  backend/        NestJS API (port 3001)
  frontend/       Next.js app (port 3000)
  imap-daemon/    Email sync worker
packages/
  shared/         @rio/shared — types and constants shared across apps
docker/
  Dockerfile.*    One Dockerfile per service
  docker-compose.yml       Local dev stack
  docker-compose.prod.yml  Production stack (with nginx + certbot)
  nginx/          nginx configs (initial, prod, no-ssl)
scripts/
  deploy.sh       Production deploy helper
  backup-db.sh    Postgres dump
  restore-db.sh   Restore from dump
  setup-ssl.sh    Let's Encrypt bootstrap
database-schema.sql   Reference schema dump
```

## Prerequisites

- Node.js 20+
- pnpm 8+
- Docker + Docker Compose
- PostgreSQL 16 (local or via Docker)
- Mailgun account (for outbound email and webhooks)

## Local development

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set a JWT_SECRET and your Mailgun keys at minimum
```

### 3a. Run the stack with Docker (easiest)

```bash
cd docker
docker compose up -d
# Brings up rio-postgres, rio-backend, rio-frontend, rio-imap-daemon
```

Frontend: http://localhost:3000 — API: http://localhost:3001

### 3b. Run services individually (for active development)

```bash
# In three terminals:
pnpm dev:backend       # NestJS watch mode on :3001
pnpm dev:frontend      # Next.js dev server on :3000
pnpm dev:imap-daemon   # IMAP sync worker with tsx watch
```

Requires Postgres reachable at `DATABASE_HOST:DATABASE_PORT` — easiest is `docker compose up -d postgres`.

### 4. Initialize the database

```bash
pnpm db:migrate
```

Runs TypeORM migrations in `apps/backend/src/migrations/`. For a quick schema snapshot, see `database-schema.sql`.

## Production deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for the full server setup (Docker, SSL via certbot, nginx config, Mailgun webhook, backups, health checks).

Short version: clone to the server, fill in `.env` from `.env.production.example`, run `./scripts/deploy.sh`.

## Useful commands

```bash
pnpm typecheck           # Typecheck all workspaces
pnpm lint                # Lint all workspaces
pnpm build:frontend      # Build Next.js
pnpm build:backend       # Build NestJS
pnpm build:imap-daemon   # Build daemon
pnpm db:migrate          # Run TypeORM migrations
pnpm db:generate         # Generate a new migration from entity diffs
```

## Environment variables

See [.env.example](.env.example) for dev and [.env.production.example](.env.production.example) for production.

Required at minimum:
- `DATABASE_*` — Postgres connection
- `JWT_SECRET` — generate with `openssl rand -hex 64`
- `MAILGUN_PRIVATE_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_FROM_EMAIL` — outbound mail
- `MAILGUN_WEBHOOK_SIGNING_KEY` — webhook signature verification

## Features and roadmap

See [PROJECT_STATUS.md](PROJECT_STATUS.md) for the current feature list, pending roadmap, and known issue fixes.

## License

Proprietary — all rights reserved.
