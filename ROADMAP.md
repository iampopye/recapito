# Roadmap

Honest about where Recapito is and is not. Items are ordered by impact for the
effort, not by how interesting they are to build.

If you want to work on any of these, comment on the matching issue first — or
open one. Everything here is available to contributors; nothing is reserved.

## Where Recapito actually stands

There are mature projects in this space. [Cypht](https://github.com/cypht-org/cypht)
has done unified inbox for over a decade, and [MailFlow](https://github.com/maathimself/mailflow)
is a close contemporary with a broader feature set. Being honest about that is
more useful than pretending otherwise.

What Recapito does that they do not: **tracked outbound delivery.** Sending
through Mailgun or Brevo records delivery, bounce and failure events against the
message via signed webhooks, so you can see what actually happened to mail you
sent. That is the thing worth building around.

## Now — small, high impact

- [ ] **Screenshots in the README.** There are none. Nothing costs less or
      matters more for someone deciding whether to try this.
- [ ] **Pre-built container images on GHCR.** Today you must clone and build.
      Publishing images turns setup into `docker compose up -d` against a
      published compose file — the single biggest adoption barrier.
- [ ] **Sending attachments.** Receiving works end to end; sending does not.
      A half-implemented feature reads worse than an absent one.
- [ ] **HTTPS out of the box.** A Caddy-based compose profile so a self-hoster
      gets TLS without hand-writing nginx and certbot config.
- [ ] **Health endpoint that means something** — check the database and IMAP
      reachability rather than returning 200 unconditionally.

## Next — meaningful features

- [ ] **OAuth2 / XOAUTH2 for Gmail and Outlook** —
      [#5](https://github.com/iampopye/recapito/issues/5). The highest-value
      item in the project. Password-only IMAP is being withdrawn by the large
      providers, so this decides whether people can connect their main mailbox
      at all.
- [ ] **Rich text compose.** Currently plaintext only.
- [ ] **Inbox rules** — move, archive, delete, star, mark read, based on
      sender, subject, recipient or headers.
- [ ] **Full folder navigation and folder-structure sync.** Folders created in
      another client should appear here.
- [ ] **Snooze** — hide a message until a chosen time.
- [ ] **Unsubscribe** — detect `List-Unsubscribe` and offer one click.
- [ ] **Real-time delivery to the browser.** The IMAP daemon already receives
      mail by IDLE within seconds; the UI still waits for a poll.

## Later

- [ ] Message categorisation (Primary / Newsletters / Social)
- [ ] Saved searches
- [ ] Email forwarding
- [ ] PWA with push notifications
- [ ] Command palette
- [ ] Interface translations
- [ ] S3-compatible attachment storage for larger deployments

## Deliberately not planned

- **Becoming a mail server.** Recapito syncs mailboxes you already have. It does
  not receive SMTP and is not trying to replace Postfix, Mailu or Stalwart.
- **A hosted version run by this project.** Running it would mean holding other
  people's mail and IMAP credentials. That contradicts the reason this software
  exists, so it will not happen here — self-host it, or have someone you already
  trust host it.

## Known gaps worth naming

- Threads are scoped per mailbox and do not merge across accounts. Search does
  span every mailbox.
- No two-factor authentication on the Recapito account itself.
- The session token is held in `localStorage`. Email HTML renders inside a
  sandboxed iframe specifically so that a hostile message cannot reach it, but
  moving to an httpOnly cookie would be stronger.
- No import path from another mail client.
