#!/bin/bash
set -e

DEPLOY_PATH="$1"

if [ -z "$DEPLOY_PATH" ]; then
    echo "Usage: $0 <deploy_path>"
    exit 1
fi

echo "=== Deployment Started ==="
echo "Target: $DEPLOY_PATH"

cd "$DEPLOY_PATH" || { echo "Failed to cd to $DEPLOY_PATH"; exit 1; }
echo "Working in: $(pwd)"

# PHP 8.2 path
PHP_BIN="/usr/php82/usr/bin/php"
echo "PHP: $PHP_BIN"
$PHP_BIN -v | head -n 1

# Verify artisan
if [ ! -f "artisan" ]; then
    echo "artisan not found in $(pwd)"
    ls -la
    exit 1
fi

# Create dirs
mkdir -p storage/backups storage/app/public storage/logs storage/framework/{cache,sessions,views}

# Backup DB
# Backup DB
echo "Backing up database..."
$PHP_BIN artisan db:backup --keep=0 || echo "Backup failed but continuing deployment"

# Laravel commands
echo "Running migrations..."
$PHP_BIN artisan migrate --force --no-interaction

echo "Clearing caches..."
$PHP_BIN artisan optimize:clear

echo "Caching..."
$PHP_BIN artisan config:cache
$PHP_BIN artisan route:cache
$PHP_BIN artisan view:cache

echo "Linking storage..."
rm -rf public/storage
$PHP_BIN artisan storage:link

echo "=== Deployment Complete ==="
