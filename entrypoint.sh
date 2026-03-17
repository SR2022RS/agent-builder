#!/usr/bin/env bash
# =============================================================================
# Holigenix Agent Builder — Entrypoint
# =============================================================================
# 1. Start the server in the background
# 2. Run skill installer (non-blocking, first boot only)
# 3. Wait for the server process
# =============================================================================

set -euo pipefail

echo "[entrypoint] Starting Holigenix Agent Builder..."

# Start the Node.js server
node src/server.js &
SERVER_PID=$!

# Give the server a moment to initialize
sleep 5

# Run skill installer in the background (won't block startup)
if [ -f ./scripts/install-skills.sh ]; then
  echo "[entrypoint] Launching skill installer in background..."
  bash ./scripts/install-skills.sh &
fi

# Wait for the server process (keeps container alive)
wait $SERVER_PID
