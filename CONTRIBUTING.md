# Contributing to Recapito

Thank you for being here. Recapito is a community project, and it gets better when people who use it improve it.

**If this would be your first open source contribution, you are especially welcome.** Fixing a typo, correcting a setup instruction that did not work on your machine, or opening an issue that just says "I got stuck at step 3" are all real contributions. The documentation is part of the product; a confusing README is a bug.

**Beginner questions are welcome.** You do not need to prove you tried hard enough before asking. If you are stuck, open an issue and describe where. Nobody here will tell you to read the source and figure it out.

Everyone taking part is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Contents

- [Ways to contribute](#ways-to-contribute)
- [Good first issues](#good-first-issues)
- [Setting up your development environment](#setting-up-your-development-environment)
- [Running the three services](#running-the-three-services)
- [Project layout](#project-layout)
- [Where to add a feature](#where-to-add-a-feature)
- [Working with the database](#working-with-the-database)
- [Testing](#testing)
- [Coding conventions](#coding-conventions)
- [Commit conventions](#commit-conventions)
- [Pull request process](#pull-request-process)
- [Security issues](#security-issues)
- [Licensing of contributions](#licensing-of-contributions)

---

## Ways to contribute

- **Report a bug.** Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.yml). Read the redaction checkbox carefully — this is a mail application, and logs contain other people's email.
- **Request a feature.** Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.yml). Explain the problem you have, not just the solution you imagined; the problem is the more useful half.
- **Improve the docs.** If an instruction did not work, fix it. You have information nobody who already has it working does.
- **Write code.** See [Good first issues](#good-first-issues) below.
- **Test on a provider we have not tried.** Recapito is developed against a handful of IMAP hosts. If it misbehaves on yours, that is worth an issue on its own.

## Good first issues

Issues labelled [`good first issue`](https://github.com/iampopye/recapito/labels/good%20first%20issue) are scoped to be completable without knowing the whole codebase. If one is unassigned, comment on it and it is yours — no need to ask permission first, and no rush to finish. If you start and get stuck, say so in the thread; a half-finished attempt with a question is more useful than silence.

If nothing is labelled yet, these are reliably approachable:

- **Documentation gaps** — anything in the README or this file that did not match what actually happened for you.
- **Frontend polish** — empty states, loading states, error messages that currently say nothing useful.
- **Small roadmap items** — the [Roadmap](README.md#roadmap) lists what is not built. Attachments and rich-text compose are the most requested.
- **Accessibility** — the inbox UI has had no formal accessibility pass. Keyboard navigation and screen reader labelling both have room.

Bigger items (attachments end-to-end, schedule send, filters) are worth opening a discussion issue on before writing code, so we can agree on the shape first. That is to save you rework, not to gatekeep.

## Setting up your development environment

**What you need**

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20 or newer | The Docker images use Node 20 |
| pnpm | 8 or newer | `npm install -g pnpm` |
| Docker | any recent | With the Compose plugin, for Postgres |
| An IMAP account | — | See the warning below |

> **Use a throwaway mailbox.** Do not point your development instance at your primary personal or work email. Recapito stores mail in a local database, and you will be reading logs that contain it. Create a free account somewhere, or a dedicated alias, and send test mail to it.

**1. Fork and clone**

```bash
git clone https://github.com/YOUR-USERNAME/recapito.git
cd recapito
git remote add upstream https://github.com/iampopye/recapito.git
```

**2. Install dependencies**

```bash
pnpm install
```

This installs for every workspace in the monorepo at once. You do not need to install inside `apps/backend` separately.

**3. Create your `.env`**

```bash
cp .env.example .env
```

Generate the three secrets that have no default:

```bash
echo "JWT_SECRET=$(openssl rand -hex 64)"
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)"
echo "DATABASE_PASSWORD=$(openssl rand -base64 32)"
```

Paste them into `.env`. The backend validates all three at startup and **refuses to boot** without them — if you see a startup error listing missing configuration, that is this check working, and the message tells you exactly what to fix.

Leave `DATABASE_HOST=localhost` for local development.

**4. Start Postgres**

You do not need to install Postgres locally; run just the database container:

```bash
cd docker
docker compose --env-file ../.env up -d postgres
cd ..
```

The Compose files live in `docker/` while `.env` lives in the repository root, which is why `--env-file` is needed.

**5. Run the migrations**

```bash
pnpm db:migrate
```

## Running the three services

Recapito is three processes. Give each its own terminal:

```bash
pnpm dev:backend       # NestJS API, watch mode, http://localhost:3001/api
pnpm dev:frontend      # Next.js dev server,   http://localhost:3000
pnpm dev:imap-daemon   # IMAP sync daemon, tsx watch
```

**What each one does, and when you need it:**

- **backend** — the API. Needed for anything. Start here.
- **frontend** — the web client. Needed for UI work. It talks to the backend over HTTP at `NEXT_PUBLIC_API_URL`, so the backend must be running or every page will error.
- **imap-daemon** — pulls mail in from IMAP. **You only need this if you are working on sync.** If you are changing the compose screen or the labels API, skip it; your database just will not receive new mail.

Sanity checks:

```bash
curl http://localhost:3001/api/health     # should report ok
pnpm typecheck                            # every workspace
pnpm lint                                 # every workspace with a lint script
```

Register your first user at <http://localhost:3000/register>, add a mailbox under **Mailboxes**, and if the daemon is running it will start syncing within a minute or so. Watch its terminal output — it is verbose on purpose.

## Project layout

```
apps/
  backend/          NestJS API, port 3001, all routes prefixed /api
  frontend/         Next.js 14 App Router client, port 3000
  imap-daemon/      Standalone IMAP sync worker, no HTTP surface
packages/
  shared/           @recapito/shared — types and constants used by all three
docker/             Dockerfiles, Compose stacks, nginx configs
scripts/            deploy, backup, restore, SSL bootstrap
```

A few things worth knowing before you go looking:

- **The daemon shares the database, not the API.** `apps/imap-daemon` has its own copy of the `Mailbox`, `Thread` and `Message` entities and writes to Postgres directly. If you change one of those entities in `apps/backend/src/entities/`, check whether the daemon's copy in `apps/imap-daemon/src/entities/` needs the same change.
- **Types shared between frontend and backend live in `packages/shared`.** If the API's response shape changes, update the type there rather than redeclaring it on both sides.
- **Migrations are the source of truth for the schema.** `database-schema.sql` in the root is a reference dump for reading, not something to apply.

## Where to add a feature

The backend is organised as NestJS modules, one per domain concept, under `apps/backend/src/modules/`. Existing modules: `auth`, `users`, `mailboxes`, `threads`, `messages`, `labels`, `drafts`, `signatures`, `templates`, `contacts`, `settings`, `smtp-providers`, `mailgun`, `health`.

**To add a new one**, follow the shape every existing module already uses — `labels` is a good small one to read first:

```
apps/backend/src/modules/your-feature/
  your-feature.module.ts       Wires the controller, service and entities together
  your-feature.controller.ts   HTTP routes. Thin: validate, delegate, return.
  your-feature.service.ts      Business logic and database access.
  dto/
    create-your-feature.dto.ts class-validator decorated request shapes
```

Then:

1. **Add the entity** in `apps/backend/src/entities/`, and export it from `entities/index.ts`.
   Always give `@Column` an explicit `type` — `type: 'uuid'`, `type: 'varchar'`, and so on. TypeORM fails at runtime with "Data type Object not supported" if you leave it to inference, and it is an annoying error to diagnose.
2. **Register the module** in `apps/backend/src/app.module.ts`.
3. **Guard the controller** with `@UseGuards(JwtAuthGuard)` and take the caller via the `@CurrentUser()` decorator. Scope every query to that user — do not trust an ID from the request body to identify whose data to return.
4. **Generate a migration** — see below.
5. **Add shared types** in `packages/shared/src/types/` if the frontend needs them.
6. **Add the frontend page** under `apps/frontend/src/app/(dashboard)/`, and the API calls in `apps/frontend/src/lib/api.ts`.

**Storing a credential?** Do not add a plain `varchar` column and write the secret into it. Use the encryption in `apps/backend/src/common/crypto/` so it is encrypted at rest like every other stored credential. If you are unsure how, ask in the PR — this is the single easiest thing to get wrong here, and reviewers would much rather answer the question than catch it later.

## Working with the database

Change an entity, then generate a migration from the diff:

```bash
pnpm db:generate --name AddYourFeature
pnpm db:migrate
```

Review the generated SQL before committing it. TypeORM's diffing is good but not clairvoyant, and it will occasionally propose dropping something you wanted to keep.

**Migrations are the only supported way to change the schema.** The API runs pending migrations on startup in every environment (`DB_MIGRATIONS_RUN`, on by default). TypeORM's `synchronize` mode is available behind `DB_SYNCHRONIZE=true` but is off by default and should stay that way — it can drop columns, and the data in them, on boot.

So: if you change an entity without generating a migration, your change simply will not be in the database. That is deliberate, and it fails the same way locally as it would on a server.

## Testing

Honest status: **the test suite is young and coverage is thin.** There are specs covering credential encryption, the auth service, the users service, and shared constants — and nothing else. Frontend tests are not set up at all.

Conventions that are stable:

- Tests live next to the code they cover, named `*.spec.ts`.
- Backend specs use `@nestjs/testing` to build a testing module rather than instantiating services by hand.
- Anything touching credentials or authentication should have a test. Those are the paths where a silent regression is most expensive.

> **Note:** the test runner setup is in flux at the time of writing — check `package.json` for the current test script before assuming a command. If there is no test script yet and you want to add one, that is a genuinely useful PR.

Adding tests to an area that has none is one of the most valuable contributions available right now, and will never be treated as scope creep.

Before opening a PR:

```bash
pnpm typecheck   # must pass
pnpm lint        # must pass
```

Because coverage is thin, **also verify your change by hand**. In your PR description, say what you actually did — "added a label, reloaded, confirmed it persisted, deleted it" is exactly the right level of detail. If you are touching sync, say which IMAP provider you tested against, because behaviour genuinely differs between them.

## Coding conventions

- **TypeScript throughout.** No new `.js` files.
- **Explicit `type` on every TypeORM `@Column`.** See above.
- **Validate input at the boundary** with `class-validator` DTOs. The global `ValidationPipe` runs with `whitelist` and `forbidNonWhitelisted`, so undeclared properties are rejected — declare everything you accept.
- **Never log credentials or message content.** Log identifiers, not bodies. A log line with someone's email in it is a data leak that outlives the debugging session.
- **Match the surrounding style.** The codebase is not heavily abstracted; prefer clear and boring over clever.
- Run `pnpm lint` before you push; it auto-fixes most formatting.

## Commit conventions

[Conventional Commits](https://www.conventionalcommits.org/). The format:

```
<type>(<optional scope>): <description>
```

Types in use here:

| Type | For |
|------|-----|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | A performance improvement |
| `style` | Formatting only, no code meaning changed |
| `chore` | Tooling, dependencies, build |
| `ci` | CI configuration |

Useful scopes: `backend`, `frontend`, `daemon`, `shared`, `docker`, `docs`.

Examples:

```
feat(backend): add attachment download endpoint
fix(daemon): reconnect IDLE after socket timeout
docs: correct the pnpm version in the setup instructions
chore(docker): pin postgres to 16.4
```

Write the description in the imperative — "add", not "added" or "adds". Keep the first line under about 72 characters. If the change needs explaining, put that in the body; the reasoning is usually more valuable than the summary.

If your commits end up messy, do not worry about it — say so in the PR and we can squash on merge.

## Pull request process

1. **Branch from `main`**, named for what it does: `feat/attachment-download`, `fix/idle-reconnect`, `docs/setup-instructions`.
2. **Keep it focused.** One logical change per PR. A small PR gets reviewed in a day; a large one waits for someone to find an hour.
3. **Fill in the [PR template](.github/pull_request_template.md).** It is short.
4. **Make sure `pnpm typecheck` and `pnpm lint` pass.**
5. **Describe how you tested it.** See [Testing](#testing).
6. **Redact everything.** If you paste logs, screenshots, or sample data into the PR, remove real email addresses, message subjects and bodies, and anything resembling a credential first.
7. **Open it.** Drafts are fine and encouraged if you want feedback before finishing.

What happens next: a maintainer reads it and either merges, asks questions, or requests changes. Review comments are about the code, never about you — and if a suggestion does not make sense, saying "I do not understand, can you explain?" is a completely normal reply.

Response times are best-effort. This is maintained alongside a job. If a week goes by with no reply, a polite nudge on the thread is welcome and not annoying.

## Security issues

**Do not open a public issue for a security vulnerability.** See [SECURITY.md](SECURITY.md) for how to report one privately through GitHub security advisories.

This includes anything that exposes stored mailbox credentials, allows one user to read another's mail, or lets someone forge a session.

## Licensing of contributions

Recapito is licensed under the [GNU Affero General Public License v3.0](LICENSE). By contributing, you agree that your contributions are licensed under the same terms.

There is no CLA to sign.
