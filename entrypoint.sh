#!/usr/bin/env bash
# =============================================================================
# HighLevel Agent Builder — Entrypoint
# =============================================================================
# 1. Start the server in the background
# 2. Run skill installer (non-blocking, first boot only)
# 3. Wait for the server process
# =============================================================================

set -euo pipefail

echo "[entrypoint] Starting HighLevel Agent Builder..."

# Auto-heal config before startup: remove unknown keys, fix channel structure.
# This is idempotent — safe to run every boot.
CONFIG_FILE="${OPENCLAW_STATE_DIR:-$HOME/.openclaw}/openclaw.json"
if [ -f "$CONFIG_FILE" ]; then
  echo "[entrypoint] Running openclaw doctor --fix to validate config..."
  openclaw doctor --fix 2>&1 || echo "[entrypoint] doctor --fix exited non-zero (may be ok if config was already clean)"

  # Remove unsupported MCP keys — OpenClaw v2026.3.x rejects them during config validation
  if command -v node > /dev/null 2>&1; then
    node -e "
      const fs = require('fs');
      const p = '$CONFIG_FILE';
      try {
        const c = JSON.parse(fs.readFileSync(p, 'utf8'));
        let dirty = false;
        if (c.mcpServers) { delete c.mcpServers; dirty = true; console.log('[entrypoint] Removed unsupported mcpServers key'); }
        if (c.mcp) { delete c.mcp; dirty = true; console.log('[entrypoint] Removed unsupported mcp key'); }
        if (dirty) { fs.writeFileSync(p, JSON.stringify(c, null, 2)); console.log('[entrypoint] ✓ Config cleaned'); }
      } catch(e) { console.warn('[entrypoint] Config cleanup skipped:', e.message); }
    "
  fi
fi

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
