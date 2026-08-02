#!/bin/bash
set -e

# SSL Certificate Setup Script using Let's Encrypt
# Usage: ./scripts/setup-ssl.sh yourdomain.com

DOMAIN=$1
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

if [ -z "$DOMAIN" ]; then
    echo "Usage: ./scripts/setup-ssl.sh yourdomain.com"
    exit 1
fi

echo "=========================================="
echo "Setting up SSL for: $DOMAIN"
echo "=========================================="

cd "$PROJECT_DIR/docker"

# Create directories
mkdir -p nginx/ssl
mkdir -p nginx/certbot/www

# Use no-SSL config first
echo "Step 1: Starting with HTTP-only config..."
cp nginx/nginx.nossl.conf nginx/nginx.conf

# Start nginx
docker compose -f docker-compose.prod.yml up -d nginx

echo "Step 2: Obtaining SSL certificate..."
docker compose -f docker-compose.prod.yml run --rm certbot certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email admin@$DOMAIN \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN \
    -d www.$DOMAIN

echo "Step 3: Updating Nginx config for SSL..."
# Update the SSL config with the actual domain
sed -i "s/yourdomain.com/$DOMAIN/g" nginx/nginx.conf

# Restore the SSL config
cat > nginx/nginx.conf << 'NGINX_CONF'
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent"';

    access_log /var/log/nginx/access.log main;
    sendfile on;
    keepalive_timeout 65;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

    upstream frontend { server frontend:3000; }
    upstream backend { server backend:3001; }

    server {
        listen 80;
        server_name DOMAIN_PLACEHOLDER;
        location /.well-known/acme-challenge/ { root /var/www/certbot; }
        location / { return 301 https://$host$request_uri; }
    }

    server {
        listen 443 ssl http2;
        server_name DOMAIN_PLACEHOLDER;

        ssl_certificate /etc/nginx/ssl/live/DOMAIN_PLACEHOLDER/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/live/DOMAIN_PLACEHOLDER/privkey.pem;
        ssl_session_timeout 1d;
        ssl_session_cache shared:SSL:50m;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_prefer_server_ciphers off;

        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;

        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
NGINX_CONF

sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" nginx/nginx.conf

echo "Step 4: Reloading Nginx with SSL..."
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload

echo "=========================================="
echo "SSL setup complete!"
echo "Your site is now available at: https://$DOMAIN"
echo "=========================================="
