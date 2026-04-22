#!/bin/bash
set -e

# Database Backup Script
# Usage: ./scripts/backup-db.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Load environment
set -a
source "$PROJECT_DIR/.env"
set +a

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "Creating database backup..."

docker exec rio-postgres pg_dump \
    -U "$DATABASE_USERNAME" \
    -d "$DATABASE_NAME" \
    --format=custom \
    --compress=9 \
    > "$BACKUP_DIR/rio_mailer_$TIMESTAMP.dump"

echo "Backup created: $BACKUP_DIR/rio_mailer_$TIMESTAMP.dump"

# Keep only last 7 backups
cd "$BACKUP_DIR"
ls -t *.dump 2>/dev/null | tail -n +8 | xargs -r rm --

echo "Cleanup complete. Current backups:"
ls -lh "$BACKUP_DIR"/*.dump 2>/dev/null || echo "No backups found"
