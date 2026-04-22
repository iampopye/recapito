# Rio Mailer - Deployment Guide

## Prerequisites

- Ubuntu 22.04+ server (or similar Linux)
- Docker & Docker Compose installed
- Domain name pointing to your server
- Mailgun account with verified domain

## Quick Start

### 1. Server Setup

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin

# Clone repository
git clone https://github.com/yourusername/rio-mailer.git /opt/rio-mailer
cd /opt/rio-mailer
```

### 2. Configure Environment

```bash
# Copy production environment template
cp .env.production.example .env

# Generate secure JWT secret
JWT_SECRET=$(openssl rand -hex 64)
sed -i "s/CHANGE_ME_GENERATE_SECURE_SECRET/$JWT_SECRET/" .env

# Generate database password
DB_PASS=$(openssl rand -base64 32)
sed -i "s/CHANGE_ME_STRONG_PASSWORD_HERE/$DB_PASS/" .env

# Edit remaining values
nano .env
```

### 3. Initial Deployment (No SSL)

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Use no-SSL nginx config initially
cp docker/nginx/nginx.nossl.conf docker/nginx/nginx.conf

# Deploy
./scripts/deploy.sh
```

### 4. Setup SSL Certificate

```bash
# Replace with your domain
./scripts/setup-ssl.sh yourdomain.com
```

### 5. Configure Mailgun Webhook

In your Mailgun dashboard:
1. Go to **Sending** → **Webhooks**
2. Add webhook URL: `https://yourdomain.com/api/mail/webhook`
3. Select events: `delivered`, `failed`, `bounced`
4. Copy the signing key to your `.env` file

## Management Commands

### Deploy Updates
```bash
cd /opt/rio-mailer
git pull
./scripts/deploy.sh
```

### View Logs
```bash
cd /opt/rio-mailer/docker

# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f imap-daemon
```

### Backup Database
```bash
./scripts/backup-db.sh
```

### Restore Database
```bash
./scripts/restore-db.sh backups/rio_mailer_TIMESTAMP.dump
```

### Restart Services
```bash
cd /opt/rio-mailer/docker
docker compose -f docker-compose.prod.yml restart
```

### Stop Services
```bash
cd /opt/rio-mailer/docker
docker compose -f docker-compose.prod.yml down
```

## CI/CD

No GitHub Actions workflows are included in this repo by default. Deployments are manual via `./scripts/deploy.sh`. To add CI/CD, create workflows under `.github/workflows/` — you'll need a token with `workflow` scope to push them.

Suggested required GitHub Secrets if you do wire up Actions:

| Secret | Description |
|--------|-------------|
| `DEPLOY_HOST` | Server IP or hostname |
| `DEPLOY_USER` | SSH username |
| `DEPLOY_SSH_KEY` | Private SSH key |
| `NEXT_PUBLIC_API_URL` | Production API URL |
| `HEALTH_CHECK_URL` | URL for health check |

## Monitoring

### Health Endpoints

- `GET /api/health` - Full health check (DB, uptime)
- `GET /api/health/live` - Liveness probe
- `GET /api/health/ready` - Readiness probe

### Recommended: Setup Uptime Monitoring

Use services like:
- UptimeRobot
- Better Stack
- Pingdom

Monitor: `https://yourdomain.com/api/health`

## Troubleshooting

### Backend won't start
```bash
docker compose -f docker-compose.prod.yml logs backend
```

### Database connection issues
```bash
# Check postgres is running
docker compose -f docker-compose.prod.yml ps postgres

# Test connection
docker compose -f docker-compose.prod.yml exec postgres psql -U rio_prod -d rio_mailer_prod -c "SELECT 1"
```

### IMAP sync not working
```bash
docker compose -f docker-compose.prod.yml logs imap-daemon
```

### SSL certificate renewal
Certbot auto-renews via the certbot container. To manually renew:
```bash
docker compose -f docker-compose.prod.yml run --rm certbot certbot renew
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

## Security Checklist

- [ ] Strong database password
- [ ] Strong JWT secret (64+ chars)
- [ ] Firewall configured (ports 80, 443 only)
- [ ] SSL enabled
- [ ] Mailgun webhook signing key configured
- [ ] Regular backups scheduled
- [ ] Monitoring configured
