#!/bin/bash
set -e
echo "Starting Minecraft server..."
docker compose up -d
echo "Waiting for server to be ready..."
for i in $(seq 1 36); do
  if docker compose exec minecraft mc-health 2>/dev/null; then
    echo "Server ready!"
    break
  fi
  if [ $i -eq 36 ]; then
    echo "Server failed to start in 3 minutes"
    exit 1
  fi
  sleep 5
done
if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi
echo "Starting bots..."
node src/index.js
