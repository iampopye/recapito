# Rio Mailer — Features & Roadmap

## Implemented

### Core mail
- Unified inbox across multiple mailboxes
- Thread-based message display
- Folder navigation (Inbox, Sent, Drafts, Spam, Trash)
- Search across threads and messages
- Realtime IMAP sync (priority INBOX polling + background sync on other folders)
- Outbound via Mailgun with delivery/failure webhook tracking
- Optional SMTP provider fallback

### Productivity
- Labels / tags for categorization
- Drafts with auto-save
- Email signatures (multiple per user)
- Reply templates / canned responses
- Bulk actions (multi-select, delete, move)
- Gmail-style keyboard shortcuts
- Contacts / address book

### Admin
- User management
- Mailbox (IMAP account) management
- SMTP provider management
- Mailgun configuration
- Settings page

## Roadmap

- Email attachments — view and send
- Schedule send
- Email forwarding
- Rich text editor for compose
- Filters / rules for auto-categorization
- Saved searches

## IMAP sync behavior

- **Priority sync:** INBOX polled every 1 second (configurable via `IMAP_POLL_INTERVAL_MS`)
- **Background sync:** Sent / Spam / Trash polled every 5 minutes
- **Fetch strategy:** UID-based delta fetching (`UID > lastUid`) in batches of 50
- **Date window:** queries limited to last 30 minutes for reliable new-mail detection
- **Initial sync:** capped at 1 day of history to avoid overwhelming the mailbox on first connect

## Known issues and fixes

### 502 Bad Gateway after backend restart
**Cause:** nginx caches the backend container's IP. When the backend restarts with a new IP, nginx keeps resolving to the old one.
**Fix:** `docker exec <nginx-container> nginx -s reload` after any backend restart. Restart scripts include this.

### TypeORM "Data type Object not supported"
**Cause:** Missing explicit type annotations on entity columns.
**Fix:** Always specify an explicit `type` on `@Column` decorators (e.g. `type: 'uuid'`, `type: 'varchar'`). This is enforced in `apps/backend/src/entities/`.

### IMAP sync slow or stalling on large mailboxes
**Cause:** Fetching all messages at once overwhelms the IMAP connection and hits Gmail's rate limits.
**Fix:** Delta-only fetch (UID > lastUid), batches of 50, 1-day initial cap. See `apps/imap-daemon/src/services/imap-sync.service.ts`.
