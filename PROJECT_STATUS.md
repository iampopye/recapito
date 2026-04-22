# Rio Mailer - Project Status

## Server Connection
- **Server IP:** 143.198.13.154
- **SSH Key:** `D:\Rio Mailer\id_rsa`
- **SSH Command:** `ssh -i "/d/Rio Mailer/id_rsa" root@143.198.13.154`
- **Project Path on Server:** `/opt/rio-mailer`

## Domains
- **Frontend:** https://mailer.yourdomain.com (behind Cloudflare)
- **API:** https://api.yourdomain.com (direct, no Cloudflare)

## Docker Containers
- `rio-postgres` - PostgreSQL database
- `rio-backend` - NestJS API backend
- `rio-frontend` - Next.js frontend
- `rio-imap-daemon` - Email sync daemon
- `rio-nginx` - Reverse proxy
- `rio-certbot` - SSL certificate renewal

## Common Commands
```bash
# SSH to server
ssh -i "/d/Rio Mailer/id_rsa" root@143.198.13.154

# Check container status
docker ps -a

# Check logs
docker logs rio-backend --tail 50
docker logs rio-frontend --tail 50
docker logs rio-imap-daemon --tail 50
docker logs rio-nginx --tail 50

# Restart containers
cd /opt/rio-mailer/docker
docker compose -f docker-compose.prod.yml restart <container-name>

# Rebuild and deploy
docker compose -f docker-compose.prod.yml build <service-name>
docker compose -f docker-compose.prod.yml up -d <service-name>

# Reload nginx (for DNS cache issues)
docker exec rio-nginx nginx -s reload
```

## Deployment Steps
1. Create tar archive locally:
   ```bash
   cd "D:\Rio Mailer"
   tar -cvf deploy.tar apps packages docker pnpm-workspace.yaml package.json pnpm-lock.yaml
   ```

2. Upload to server:
   ```bash
   scp -i "/d/Rio Mailer/id_rsa" deploy.tar root@143.198.13.154:/opt/rio-mailer/
   ```

3. Extract and rebuild on server:
   ```bash
   cd /opt/rio-mailer && tar -xf deploy.tar
   cd docker && docker compose -f docker-compose.prod.yml build --no-cache <service>
   docker compose -f docker-compose.prod.yml up -d <service>
   ```

## Environment Variables
Located at `/opt/rio-mailer/docker/.env`:
- `IMAP_POLL_INTERVAL_MS=1000` (1 second refresh)

## Current Features Implemented
1. Labels/Tags for email categorization
2. Drafts folder with auto-save
3. Email Signatures management
4. Quick Reply Templates/Canned Responses
5. Bulk Actions (select multiple, delete, move)
6. Keyboard Shortcuts (Gmail-style)
7. Contact/Address Book management
8. Frontend pages: Contacts, Templates, Signatures

## Pending Features
1. Email Attachments support (view and send)
2. Schedule Send feature
3. Email Forwarding
4. Rich Text Editor for compose
5. Email Filters/Rules for auto-categorization

## Known Issues & Fixes

### 502 Bad Gateway on API
**Cause:** Nginx caches container IPs. When backend restarts with new IP, nginx still uses old IP.
**Fix:** `docker exec rio-nginx nginx -s reload`

### IMAP Sync Slow/Failing
**Cause:** Trying to fetch all messages at once.
**Fix:** Updated code to:
- Fetch only new messages (UID > lastUid)
- Batch fetch in groups of 50
- Initial sync limited to 1 day of messages

### TypeORM "Data type Object not supported"
**Cause:** Missing explicit type annotations on entity columns.
**Fix:** Add explicit `type: 'uuid'` or `type: 'varchar'` to all @Column decorators.

## Last Session Summary (Jan 22, 2026)

### What was done:
1. Fixed login "Failed to fetch" error - nginx DNS cache needed reload
2. Updated IMAP poll interval to 1 second for realtime sync
3. Fixed IMAP daemon to fetch only new messages instead of all
4. Fixed TypeScript build errors in IMAP daemon
5. Implemented priority sync (INBOX every 1 sec) and background sync (Sent/Spam every 5 min)
6. Changed sync to use 30-minute date window for reliable new email detection
7. Deployed all changes to server

### Current state:
- API working correctly
- Frontend working
- IMAP daemon running with:
  - INBOX: 1 second poll (realtime)
  - Sent/Spam/Trash: 5 minute poll (background)
- Search uses last 30 minutes date window
- 4170+ inbox threads synced, 1113+ sent threads

### IMAP Sync Logic:
- Priority sync: INBOX only, every 1 second
- Background sync: Sent, Spam, Trash, every 5 minutes
- Searches for messages from last 30 minutes
- Batches of 50 messages to avoid Gmail limits

### Next steps:
1. Verify realtime email refresh working (send test email)
2. Continue with pending features (Attachments, Schedule Send, etc.)
