#!/bin/bash
set -e

# Database Restore Script
# Usage: ./scripts/restore-db.sh backups/recapito_TIMESTAMP.dump

BACKUP_FILE=$1
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
    echo "Usage: ./scripts/restore-db.sh path/to/backup.dump"
    echo ""
    echo "Available backups:"
    ls -lh "$PROJECT_DIR/backups"/*.dump 2>/dev/null || echo "No backups found"
    exit 1
fi

# Load environment
set -a
source "$PROJECT_DIR/.env"
set +a

echo "WARNING: This will overwrite the current database!"
echo "Backup file: $BACKUP_FILE"
read -p "Are you sure? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

echo "Stopping application services..."
cd "$PROJECT_DIR/docker"
docker compose -f docker-compose.prod.yml stop backend imap-daemon frontend

echo "Restoring database..."
cat "$BACKUP_FILE" | docker exec -i recapito-postgres pg_restore \
    -U "$DATABASE_USERNAME" \
    -d "$DATABASE_NAME" \
    --clean \
    --if-exists

echo "Restarting services..."
docker compose -f docker-compose.prod.yml start backend imap-daemon frontend

echo "Database restored successfully!"
