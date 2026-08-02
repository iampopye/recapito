<!--
Thanks for contributing to Recapito.

This template is short on purpose. If something does not apply, write "n/a" and
move on — do not let it stop you opening the PR. Drafts are welcome if you want
feedback before it is finished.
-->

## What does this change?

<!-- A sentence or two. What is different after this is merged? -->

## Why?

<!--
The reasoning is usually more useful than the summary. What problem does this
solve, or what was broken?
-->

Closes #

## Type of change

<!-- Check what applies. -->

- [ ] Bug fix
- [ ] New feature
- [ ] Documentation
- [ ] Refactor / performance
- [ ] Build, CI, or tooling
- [ ] Breaking change (existing deployments need action — describe it below)

## How did you test it?

<!--
Test coverage is still thin, so this section matters. Describe what you actually
did — "created a label, reloaded, confirmed it persisted, deleted it" is exactly
the right level of detail.

If you touched IMAP sync, say which provider you tested against. Behaviour
differs meaningfully between Gmail, Fastmail, Dovecot and the rest.
-->

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] Existing tests pass, and I added tests where it was reasonable to
- [ ] Verified by hand (described below)

**What I did:**

## Database changes

<!-- Delete this section if you did not touch entities or the schema. -->

- [ ] I changed a TypeORM entity
- [ ] I generated and committed a migration (`pnpm db:generate`)
- [ ] I reviewed the generated SQL and it does only what I intended
- [ ] If I changed `Mailbox`, `Thread` or `Message`, I checked whether the daemon's copy in `apps/imap-daemon/src/entities/` needs the same change

> Migrations are the only supported way to change the schema — the API runs them
> on startup in every environment. Change an entity without one and your change
> simply will not be in the database.

## Security

- [ ] This change does not introduce a new place where a credential is stored. **If it does**, the value goes through the encryption in `apps/backend/src/common/crypto/` rather than into a plain column.
- [ ] No credentials, message bodies, or email addresses are written to logs.
- [ ] New API routes are guarded and scoped to the authenticated user.

## Redaction

- [ ] Any logs, screenshots, or sample data in this PR have real email addresses, subjects, message bodies, and credentials removed.

## Anything reviewers should know

<!--
Trade-offs you made, parts you are unsure about, questions you have. "I could not
work out how to do X, is this reasonable?" is a perfectly good thing to write here.
-->
