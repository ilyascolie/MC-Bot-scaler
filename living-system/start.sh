#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== living-system startup ==="
echo ""

# 1. Start Minecraft server via docker-compose
echo "Starting Minecraft server..."
docker compose up -d

# 2. Wait for the server to be ready
echo "Waiting for Minecraft server to be ready..."
echo "(This can take 1-3 minutes on first launch)"
echo ""

MAX_WAIT=180
ELAPSED=0

while [ $ELAPSED -lt $MAX_WAIT ]; do
  if docker compose exec -T minecraft mc-health > /dev/null 2>&1; then
    echo ""
    echo "Minecraft server is ready!"
    break
  fi

  printf "."
  sleep 5
  ELAPSED=$((ELAPSED + 5))
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
  echo ""
  echo "WARNING: Server may not be fully ready after ${MAX_WAIT}s."
  echo "Proceeding anyway — bots will retry connections."
fi

echo ""

# 3. Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
  echo ""
fi

# 4. Start the bots
echo "Starting bots..."
echo ""
node src/index.js
