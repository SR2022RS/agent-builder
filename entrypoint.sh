#!/usr/bin/env bash
# =============================================================================
# DVTOL Agent — Entrypoint (forked from openclaw-railway-template)
# =============================================================================

set -euo pipefail

echo "[entrypoint] Starting DVTOL Agent..."

# Auto-heal config before startup
CONFIG_FILE="${OPENCLAW_STATE_DIR:-$HOME/.openclaw}/openclaw.json"
if [ -f "$CONFIG_FILE" ]; then
  echo "[entrypoint] Running openclaw doctor --fix..."
  openclaw doctor --fix 2>&1 || echo "[entrypoint] doctor --fix exited non-zero (may be ok)"

  # Migrate legacy mcpServers -> mcp.servers
  if command -v node > /dev/null 2>&1; then
    node -e "
      const fs = require('fs');
      const p = '$CONFIG_FILE';
      try {
        const c = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (c.mcpServers) {
          console.log('[entrypoint] Migrating legacy mcpServers');
          c.mcp = c.mcp || {};
          c.mcp.servers = { ...(c.mcp.servers || {}), ...c.mcpServers };
          delete c.mcpServers;
          fs.writeFileSync(p, JSON.stringify(c, null, 2));
        }
      } catch(e) { console.warn('[entrypoint] Config migration skipped:', e.message); }
    "
  fi

  # GHL plugin lives in extensions/gohighlevel/ — activated by GHL_PIT_TOKEN env var
fi

# Copy DVTOL workspace files from /data/workspace if they exist
WORKSPACE_SRC="/data/workspace"
WORKSPACE_DST="${OPENCLAW_STATE_DIR:-$HOME/.openclaw}/workspace"
if [ -d "$WORKSPACE_SRC" ] && ls "$WORKSPACE_SRC"/*.md > /dev/null 2>&1; then
  echo "[entrypoint] Loading DVTOL workspace files..."
  mkdir -p "$WORKSPACE_DST"
  cp -f "$WORKSPACE_SRC"/*.md "$WORKSPACE_DST/" 2>/dev/null || true
  echo "[entrypoint] Workspace files loaded"
fi

# Start the server (handles gateway lifecycle)
node src/server.js &
SERVER_PID=$!
sleep 5

# No skill installer — DVTOL agents don't need community skills

wait $SERVER_PID
