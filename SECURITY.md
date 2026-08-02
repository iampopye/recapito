# Security Policy

Recapito stores the credentials to your email accounts and a synced copy of your mail. That makes it a higher-value target than most self-hosted applications of its size, and it is worth treating the deployment accordingly.

## Reporting a vulnerability

**Please do not open a public issue for a security vulnerability.** A public report gives every unpatched instance on the internet the same information at the same time.

Report privately through **GitHub private security advisories**:

1. Go to <https://github.com/iampopye/recapito/security/advisories/new>
2. Or, from the repository: **Security** tab → **Report a vulnerability**

This creates a private thread visible only to you and the maintainers.

### What to include

- What the vulnerability is, and the impact if it were exploited
- Steps to reproduce, or a proof of concept
- The version or commit you tested against
- Your deployment shape, if relevant (Docker Compose, behind nginx, and so on)

**Redact before you send.** Strip real email addresses, message subjects and bodies, API keys, JWTs, and mailbox passwords from anything you paste. A vulnerability report does not need real data to be convincing.

### What to expect

- **Acknowledgement within 7 days.** If you have not heard back in that time, please nudge the advisory thread.
- An assessment and a rough fix timeline after triage.
- Credit in the release notes and the advisory, unless you would rather stay anonymous.

This is a community project maintained alongside other work, so there is no formal SLA and no bug bounty. Reports are taken seriously regardless.

### Scope

**In scope**

- Anything that lets one user read, send as, or modify another user's mail
- Anything that exposes stored IMAP or SMTP credentials, encrypted or otherwise
- Authentication or session flaws — token forgery, privilege escalation to admin, session fixation
- Injection of any kind: SQL, command, template, or stored XSS in rendered message content
- Secrets leaking into logs, API responses, or error messages
- Vulnerable dependencies where you can demonstrate reachable impact

**Out of scope**

- Findings against a deployment that ignores the [hardening checklist](#deployment-hardening-checklist) below — an instance with Postgres open to the internet is a misconfiguration, not a Recapito vulnerability
- Vulnerabilities in Mailgun, Brevo, or your IMAP provider — report those to them
- Missing rate limiting on a self-hosted instance you control the network access to (still worth an issue, just not an advisory)
- Automated scanner output with no demonstrated impact

## Supported versions

Recapito is pre-1.0 and moves on the `main` branch. Security fixes land on `main` and go out in the next release.

| Version | Supported |
|---------|-----------|
| `main` (latest commit) | Yes |
| Latest tagged release | Yes |
| Anything older | No |

There are no long-term support branches, and fixes are not backported. If you are self-hosting, track the latest release. Once 1.0 ships, this table will be replaced with a real support window.

## Security model

Understanding what Recapito protects, and how, tells you what your deployment still has to protect itself.

### Credentials encrypted at rest

Recapito must be able to present your actual IMAP password to your mail server on every connection. That rules out hashing — hashes are one-way by design, correct for a password you only ever *verify*, useless for one you have to *replay*. So these credentials are encrypted, reversibly, and the deployment's job is to protect the key.

- **Algorithm:** AES-256-GCM, an authenticated cipher. Tampering with stored ciphertext is detected at decrypt time rather than silently producing garbage that gets sent to a mail server.
- **IV:** a fresh random 96-bit initialisation vector per encrypted value. Values are never encrypted deterministically, so identical passwords do not produce identical ciphertext.
- **Storage format:** a version-prefixed envelope, so the scheme can be changed later without guessing what old rows contain.
- **What is encrypted:** IMAP mailbox passwords, SMTP passwords, and provider API keys (Mailgun, Brevo).
- **What is displayed:** stored secrets are masked in API responses — only the last few characters are returned, enough to recognise which key is configured, not enough to recover it.

**User login passwords are different.** Those are hashed with bcrypt, one-way, and are never decryptable — which is correct, because the server only ever needs to check whether a submitted password matches.

### Mandatory secrets, no fallbacks

`JWT_SECRET` and `ENCRYPTION_KEY` are both required. Neither has a default, a fallback, or a development shortcut.

The API validates them at startup and refuses to boot if either is:

- missing or empty
- set to a well-known placeholder (`changeme`, `secret`, `password`, and similar)
- too weak — `JWT_SECRET` must be at least 32 characters, `ENCRYPTION_KEY` must be exactly 64 hex characters

Generate them with:

```bash
openssl rand -hex 64   # JWT_SECRET
openssl rand -hex 32   # ENCRYPTION_KEY  (32 bytes = 64 hex chars)
```

This is intentionally rigid. A deployment that boots successfully while signing tokens with a guessable secret looks healthy and is completely compromised. Failing to start is the safer outcome.

### `ENCRYPTION_KEY`: rotation and loss

**This is the most important operational fact in this document.**

**Losing `ENCRYPTION_KEY` is unrecoverable.** There is no escrow, no recovery mechanism, and no maintainer who can help. Every stored IMAP and SMTP credential becomes permanently undecryptable, and every mailbox and send provider must be re-entered by hand.

Consequences to plan for:

- **Back the key up separately from your database.** A backup archive containing both the encrypted database *and* the key is, functionally, a backup of your plaintext credentials. Store the key in a password manager or secrets manager, not next to the dump.
- **Changing the key does not re-encrypt existing rows.** The old ciphertext stays in the database and will now fail to decrypt. The API surfaces this as an explicit error telling you the key appears to have changed, rather than silently attempting to log in with garbage.
- **There is no automated rotation tooling.** To rotate the key today, you decrypt with the old key and re-save every credential — in practice, re-entering each mailbox and provider through the UI after switching the key. Plan a maintenance window; mail sync will fail in between.
- **Rotate the key if it may have been exposed** — committed to a repository, pasted in a support thread, present on a machine you no longer control. Treat every stored mailbox password as compromised in that case and change them at the providers too. The key is what stands between a stolen database dump and a stolen set of email accounts.

Never commit `.env` to version control. It is already in `.gitignore`; keep it that way.

### JWT handling

- Sessions are stateless JWTs, signed with `JWT_SECRET` (HMAC).
- Lifetime is controlled by `JWT_EXPIRES_IN`, defaulting to `7d`. Shorten it if your threat model warrants — the trade-off is more frequent logins.
- Every non-public API route is behind an authentication guard, and the authenticated user is resolved from the token rather than from any client-supplied identifier.
- **There is no token revocation list.** Because verification is stateless, an issued token stays valid until it expires. Changing `JWT_SECRET` invalidates every outstanding token at once — that is the blunt instrument available if you need to force every session to end.
- Tokens are bearer credentials. Serve the application over HTTPS only; a token intercepted in transit is a full account takeover for its remaining lifetime.

### What Recapito does not protect

Being explicit about the gaps:

- **Message bodies are stored unencrypted** in Postgres. Encrypting them would break server-side search, which is a core feature. Database-level or disk-level encryption is your lever here.
- **The IMAP daemon connects to your mail providers directly.** TLS to those providers depends on their configuration and the port you set on the mailbox.
- **There is no built-in rate limiting** on authentication endpoints. If you expose Recapito to the internet, put rate limiting in your reverse proxy.
- **There is no audit log** of who read or sent what.
- **Registration is open by default.** Anyone who can reach the registration page can create an account. Restrict access at the network or proxy layer if the instance is internet-facing and not meant to be public.

## Deployment hardening checklist

Work through this before exposing an instance to the internet.

**Secrets**

- [ ] `JWT_SECRET` generated with `openssl rand -hex 64`, unique to this deployment
- [ ] `ENCRYPTION_KEY` generated with `openssl rand -hex 32`, and **backed up separately from the database**
- [ ] `DATABASE_PASSWORD` is strong and randomly generated, not reused from anywhere
- [ ] `.env` is not in version control and is readable only by the deploying user (`chmod 600`)
- [ ] No secrets baked into Docker images or passed on a command line where they land in shell history

**Network**

- [ ] **HTTPS only.** Terminate TLS at nginx with a valid certificate — `scripts/setup-ssl.sh` bootstraps Let's Encrypt. Redirect all plain HTTP to HTTPS.
- [ ] **Postgres is not reachable from the internet.** The development `docker-compose.yml` publishes port 5432 to the host, which is convenient locally and wrong in production. Do not publish it; let it stay on the internal Docker network.
- [ ] **Firewall closed to everything but 80 and 443.** Manage the server over SSH on a key, ideally not on a public port.
- [ ] Rate limiting configured in nginx for `/api/auth/*`
- [ ] `NEXT_PUBLIC_API_URL` set to the public HTTPS URL — it is compiled into the frontend bundle at build time, so it cannot be corrected later without a rebuild

**Application**

- [ ] `NODE_ENV=production` — turns off SQL query logging, which would otherwise write query contents to your logs
- [ ] `DB_SYNCHRONIZE` unset or `false` — schema auto-sync can drop columns and their data on boot; migrations are the supported path
- [ ] `MAILGUN_WEBHOOK_SIGNING_KEY` configured, so delivery webhooks are authenticated
- [ ] Registration restricted, or the first accounts created and then access limited, if the instance is not meant to be publicly joinable
- [ ] `JWT_EXPIRES_IN` shortened from the 7-day default if appropriate

**Operations**

- [ ] **Keep Docker images updated.** Rebuild and redeploy regularly to pick up base image security patches — `node:20-alpine` and `postgres:16-alpine` both receive them. A container built once and left running for a year is a container with a year of unpatched CVEs.
- [ ] Dependency updates applied — watch Dependabot alerts on the repository
- [ ] Automated database backups scheduled (`scripts/backup-db.sh`), stored off the server, and **restore-tested at least once**
- [ ] Backups encrypted at rest; they contain your mail
- [ ] Uptime monitoring on `/api/health`
- [ ] Log retention that does not accumulate message content indefinitely

**Data handling**

- [ ] Anyone with database access understands they can read every user's mail
- [ ] Screenshots and logs are redacted before being shared in issues, PRs, or support threads

## A note on AGPL and hosted instances

Recapito is licensed under the [AGPL-3.0](LICENSE). If you modify it and offer it to other people over a network, you must make your modified source available to those users. Nothing in this security policy changes that, and there is no security-related exception to it.

---

Questions about this policy that are *not* vulnerability reports can go in a normal issue.
