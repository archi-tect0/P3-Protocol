#!/bin/bash

# Auto-rebuild script for P3 Protocol
# Ensures client/dist is always fresh before server starts

set -e

CACHE_DIR=".cache"
HASH_FILE="$CACHE_DIR/client.hash"

mkdir -p "$CACHE_DIR"

echo "[Build] Checking if client rebuild is needed..."

# Compute checksum of all client source files
CURRENT_HASH=$(find client/src client/public client/index.html shared -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.css" -o -name "*.html" -o -name "*.json" -o -name "*.js" \) -exec md5sum {} \; 2>/dev/null | sort | md5sum | cut -d' ' -f1)

# Read previous hash if exists
if [ -f "$HASH_FILE" ]; then
  PREV_HASH=$(cat "$HASH_FILE")
else
  PREV_HASH=""
fi

# Rebuild if hash changed or dist doesn't exist
if [ "$CURRENT_HASH" != "$PREV_HASH" ] || [ ! -d "client/dist" ]; then
  echo "[Build] Changes detected (hash: ${CURRENT_HASH:0:8}). Rebuilding client..."
  
  # Update version strings with new hash
  SHORT_HASH="${CURRENT_HASH:0:8}"
  VERSION="v$(date +%Y%m%d)-${SHORT_HASH}"
  
  # Update service worker cache version
  sed -i "s/const CACHE_NAME = 'dciphrs-v[^']*'/const CACHE_NAME = 'dciphrs-${VERSION}'/" client/public/sw.js 2>/dev/null || true
  
  # Update main.tsx APP_VERSION
  sed -i "s/const APP_VERSION = 'v[^']*'/const APP_VERSION = '${VERSION}'/" client/src/main.tsx 2>/dev/null || true
  
  # Build the client (skip tsc, just use vite)
  cd client
  npx vite build --mode production 2>&1 | tail -20
  cd ..
  
  # Copy updated sw.js to dist
  cp client/public/sw.js client/dist/sw.js 2>/dev/null || true
  
  # Save new hash
  echo "$CURRENT_HASH" > "$HASH_FILE"
  
  echo "[Build] Client rebuilt successfully with version ${VERSION}"
else
  echo "[Build] No changes detected, using cached build"
fi

echo "[Server] Starting server..."
exec tsx server/index.ts
