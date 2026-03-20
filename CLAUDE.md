# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Railway deployment wrapper for **Openclaw** (an AI coding assistant platform). It provides:

- A web-based setup wizard at `/setup` (protected by `SETUP_PASSWORD`)
- Automatic reverse proxy from public URL → internal Openclaw gateway
- Persistent state via Railway Volume at `/data`
- One-click backup export of configuration and workspace
- Automatic skill installation on first boot (70+ curated skills)

The wrapper manages the Openclaw lifecycle: onboarding → gateway startup → skill installation → traffic proxying.

## Tech Stack

- **Runtime**: Node.js >=22 (ES modules, `"type": "module"`)
- **Framework**: Express 5.1
- **Proxy**: http-proxy 1.18
- **Archive**: tar 7.5
- **Package manager**: pnpm (frozen lockfile in Docker; `npm run` scripts work locally)
- **No build step**: Vanilla JS, no transpilation or bundling

## Development Commands

```bash
# Local development (requires Openclaw in /openclaw or OPENCLAW_ENTRY set)
npm run dev

# Production start
npm start

# Syntax check
npm run lint

# Local smoke test (requires Docker)
npm run smoke
```

## Docker Build & Local Testing

```bash
# Build the container (builds Openclaw from source)
docker build -t openclaw-railway-template .

# Run locally with volume
docker run --rm -p 8080:8080 \
  -e PORT=8080 \
  -e SETUP_PASSWORD=test \
  -e OPENCLAW_STATE_DIR=/data/.openclaw \
  -e OPENCLAW_WORKSPACE_DIR=/data/workspace \
  -v $(pwd)/.tmpdata:/data \
  openclaw-railway-template

# Access setup wizard
open http://localhost:8080/setup  # password: test
```

## CI

GitHub Actions workflow (`.github/workflows/docker-build.yml`) runs on PRs and pushes to `main`. It builds the Docker image (no push) using Buildx with GHA cache.

## Architecture

### Request Flow

1. **User → Railway → Wrapper (Express on PORT)** → routes to:
   - `/setup/*` → setup wizard (auth: Basic with `SETUP_PASSWORD`)
   - `/api/deploy-file` → file deployment endpoint (auth: Bearer with `SETUP_PASSWORD`)
   - All other routes → proxied to internal gateway

2. **Wrapper → Gateway** (localhost:18789 by default)
   - HTTP/WebSocket reverse proxy via `http-proxy`
   - Automatically injects `Authorization: Bearer <token>` header

### Container Startup Flow

The container entrypoint (`entrypoint.sh`) runs:

1. Starts `node src/server.js` in the background
2. Waits 5 seconds for server initialization
3. Launches `scripts/install-skills.sh` in background (non-blocking, first boot only)
4. Waits on the server process (keeps container alive)

### Lifecycle States

1. **Unconfigured**: No `openclaw.json` exists
   - All non-`/setup` routes redirect to `/setup`
   - User completes setup wizard → runs `openclaw onboard --non-interactive`

2. **Configured**: `openclaw.json` exists
   - Wrapper spawns `openclaw gateway run` as child process
   - Waits for gateway to respond on multiple health endpoints
   - Proxies all traffic with injected bearer token

### Key Files

- **src/server.js** (~1052 lines, main entry): Express wrapper, proxy setup, gateway lifecycle management, configuration persistence (server logic only — no inline HTML/CSS)
- **src/public/** (static assets for setup wizard):
  - **setup.html**: Setup wizard HTML structure
  - **styles.css**: Setup wizard styling (dark theme)
  - **setup-app.js**: Client-side JS for `/setup` wizard (vanilla JS, no build step)
- **entrypoint.sh**: Container entrypoint — starts server, runs skill installer in background
- **scripts/install-skills.sh**: Auto-installs 70+ curated OpenClaw skills on first boot (idempotent, marker at `/data/.skills-installed`)
- **scripts/smoke.js**: Basic smoke test — verifies `openclaw --version` runs
- **Dockerfile**: Multi-stage build (builds Openclaw from source at pinned version, installs Homebrew for skills, sets up non-root user)
- **railway.toml**: Railway deployment config (healthcheck at `/setup/healthz`, restart on failure)
- **.env.example**: Comprehensive environment variable reference with descriptions
- **workspace/system_prompt.md**: Default AI sales agent system prompt (Holigenix)

### Environment Variables

**Required:**

- `SETUP_PASSWORD` — protects `/setup` wizard

**Recommended (Railway template defaults):**

- `OPENCLAW_STATE_DIR=/data/.openclaw` — config + credentials
- `OPENCLAW_WORKSPACE_DIR=/data/workspace` — agent workspace

**Optional:**

- `OPENCLAW_GATEWAY_TOKEN` — auth token for gateway (auto-generated if unset)
- `PORT` — wrapper HTTP port (default 8080)
- `INTERNAL_GATEWAY_PORT` — gateway internal port (default 18789)
- `INTERNAL_GATEWAY_HOST` — gateway bind address (default `127.0.0.1`)
- `OPENCLAW_ENTRY` — path to `entry.js` (default `/openclaw/dist/entry.js`)
- `OPENCLAW_CONFIG_PATH` — custom config file location
- `OPENCLAW_NODE` — Node executable for gateway (default `node`)
- `OPENCLAW_TEMPLATE_DEBUG` — set `true` for verbose debug logging

**Railway-injected (read-only):**

- `RAILWAY_PUBLIC_DOMAIN` — public domain, used for Control UI allowed origins
- `RAILWAY_GIT_COMMIT_SHA` — deployment commit hash

### Authentication Flow

The wrapper manages a **two-layer auth scheme**:

1. **Setup wizard auth**: Basic auth with `SETUP_PASSWORD` (src/server.js:279)
2. **Gateway auth**: Bearer token with multi-source resolution and automatic sync
   - **Token resolution order** (src/server.js:31-65):
     1. `OPENCLAW_GATEWAY_TOKEN` env variable (highest priority)
     2. Persisted file at `${STATE_DIR}/gateway.token`
     3. Generate new random token and persist
   - **Token synchronization**:
     - During onboarding: Synced to `openclaw.json` with verification
     - Every gateway start: Synced to `openclaw.json` with verification (src/server.js:140)
     - Reason: Openclaw gateway reads token from config file, not from `--token` flag
   - **Token injection**:
     - HTTP requests: via `proxy.on("proxyReq")` event handler (src/server.js:968)
     - WebSocket upgrades: via `proxy.on("proxyReqWs")` event handler (src/server.js:974)

### Onboarding Process

When the user runs setup (src/server.js:528+):

1. Calls `openclaw onboard --non-interactive` with user-selected auth provider and `--gateway-token` flag
2. **Syncs wrapper token to `openclaw.json`** (overwrites whatever `onboard` generated):
   - Sets `gateway.auth.token` to `OPENCLAW_GATEWAY_TOKEN` env variable
   - Verifies sync succeeded by reading config file back
   - Logs warning/error if mismatch detected
3. Writes channel configs (Telegram/Discord/Slack) directly to `openclaw.json` via `openclaw config set --json`
4. Force-sets gateway config to use token auth + loopback bind + allowInsecureAuth (src/server.js:651)
5. Auto-configures `allowedOrigins` from `RAILWAY_PUBLIC_DOMAIN` if available
6. Restarts gateway process to apply all config changes
7. Waits for gateway readiness (polls multiple endpoints)

**Important**: Channel setup bypasses `openclaw channels add` and writes config directly because `channels add` is flaky across different Openclaw builds.

### Gateway Token Injection

The wrapper **always** injects the bearer token into proxied requests so browser clients don't need to know it:

- HTTP requests: via `proxy.on("proxyReq")` event handler (src/server.js:968)
- WebSocket upgrades: via `proxy.on("proxyReqWs")` event handler (src/server.js:974)

**Important**: Token injection uses `http-proxy` event handlers (`proxyReq` and `proxyReqWs`) rather than direct `req.headers` modification. Direct header modification does not reliably work with WebSocket upgrades, causing intermittent `token_missing` or `token_mismatch` errors.

This allows the Control UI at `/openclaw` to work without user authentication.

### Skill Auto-Installation

On first boot, `scripts/install-skills.sh` installs 70+ curated skills in 7 categories:

1. **Marketing & Sales** (26 skills) — cold outreach, copywriting, lead magnets, pricing, GTM
2. **Communication** (13 skills) — phone caller, email, SMS, testimonials, social media
3. **Calendar & Scheduling** (8 skills) — Google Calendar, meeting prep, temporal cortex
4. **Search & Research** (5 skills) — ads manager, subreddit scout, PostHog, Windsor AI
5. **E-Commerce** (7 skills) — Shopify, Amazon, product visuals, price watcher
6. **Productivity & CRM** (5 skills) — WorkCRM, Attio, KVCore, invoice templates
7. **Data & Automation** (6 skills) — TikTok marketing, social media lead gen, PublOra

Features:
- **Idempotent**: checks `/data/.skills-installed` marker; skips if present and skills exist
- **Non-blocking**: runs in background, individual failures don't crash script
- **Persistent**: installs to `/data/workspace/skills` (survives redeploys via Railway Volume)
- Uses `clawhub` CLI (or `openclaw clawhub` fallback)

To force reinstall: delete `/data/.skills-installed` and redeploy.

### Deploy File API

`POST /api/deploy-file` (src/server.js:934):

- Accepts hex-encoded file content with a target path
- Writes files to the container filesystem
- Auth: Bearer token matching `SETUP_PASSWORD`

### Backup Export

`GET /setup/export` (src/server.js:867):

- Creates a `.tar.gz` archive of `STATE_DIR` and `WORKSPACE_DIR`
- Preserves relative structure under `/data` (e.g., `.openclaw/`, `workspace/`)
- Includes dotfiles (config, credentials, sessions)

### Debug Endpoint

`GET /setup/api/debug` (src/server.js:810):

- Returns diagnostic information for troubleshooting
- Protected by setup auth

### Pairing Approval

`POST /setup/api/pairing/approve` (src/server.js:838):

- Approves device pairing requests from the setup UI
- Accepts channel and pairing code

## Common Development Tasks

### Testing the setup wizard

1. Delete `${STATE_DIR}/openclaw.json` (or run Reset in the UI)
2. Visit `/setup` and complete onboarding
3. Check logs for gateway startup and channel config writes

### Testing authentication

- Setup wizard: Clear browser auth, verify Basic auth challenge
- Gateway: Remove `Authorization` header injection (src/server.js:968) and verify requests fail

### Debugging gateway startup

Check logs for:

- `[gateway] starting with command: ...` (src/server.js:215)
- `[gateway] ready at <endpoint>` (src/server.js:127)
- `[gateway] failed to become ready after 20000ms` (src/server.js:136)

If gateway doesn't start:

- Verify `openclaw.json` exists and is valid JSON
- Check `STATE_DIR` and `WORKSPACE_DIR` are writable
- Ensure bearer token is set in config
- Enable `OPENCLAW_TEMPLATE_DEBUG=true` for verbose logging

### Modifying onboarding args

Edit `buildOnboardArgs()` (src/server.js:448) to add new CLI flags or auth providers.

### Adding new channel types

1. Add channel-specific fields to `/setup` HTML (src/public/setup.html)
2. Add config-writing logic in `/setup/api/run` handler (src/server.js:528)
3. Update client JS to collect the fields (src/public/setup-app.js)

### Adding new skills

Edit `scripts/install-skills.sh` — add the skill name to the appropriate category array. The script uses `clawhub install <skill-name>`.

## Railway Deployment Notes

- Template must mount a volume at `/data`
- Must set `SETUP_PASSWORD` in Railway Variables
- Public networking must be enabled (assigns `*.up.railway.app` domain)
- Openclaw version is pinned via Docker build arg `OPENCLAW_GIT_REF` (default: `v2026.3.13-1`)
- Health check configured at `/setup/healthz` with 300s timeout (railway.toml)
- Restart policy: on_failure

## Dockerfile Details

Multi-stage build:

1. **Stage 1 (openclaw-build)**: Clones Openclaw at pinned ref, installs Bun, patches extension version constraints, builds with `pnpm install && pnpm build && pnpm ui:install && pnpm ui:build`
2. **Stage 2 (runtime)**: node:22-bookworm with build tools (gcc, g++, make, python3), Homebrew (required for some skills), non-root `linuxbrew` user, wrapper deps via pnpm, creates `/usr/local/bin/openclaw` wrapper script

## Quirks & Gotchas

1. **Gateway token must be stable across redeploys** → Always set `OPENCLAW_GATEWAY_TOKEN` env variable in Railway (highest priority); token is synced to `openclaw.json` during onboarding and on every gateway start (src/server.js:140) with verification. This is required because `openclaw onboard` generates its own random token and the gateway reads from config file, not from `--token` CLI flag. Sync failures throw errors and prevent gateway startup.
2. **Channels are written via `config set --json`, not `channels add`** → avoids CLI version incompatibilities
3. **Gateway readiness check polls multiple endpoints** (`/openclaw`, `/`, `/health`) → some builds only expose certain routes
4. **Discord bots require MESSAGE CONTENT INTENT** → document this in setup wizard
5. **Gateway spawn inherits stdio** → logs appear in wrapper output (src/server.js:215)
6. **WebSocket auth requires proxy event handlers** → Direct `req.headers` modification doesn't work for WebSocket upgrades with http-proxy; must use `proxyReqWs` event (src/server.js:974) to reliably inject Authorization header
7. **Control UI requires allowInsecureAuth to bypass pairing** → Set `gateway.controlUi.allowInsecureAuth=true` during onboarding (src/server.js:651) to prevent "disconnected (1008): pairing required" errors. Wrapper already handles bearer token auth, so device pairing is unnecessary.
8. **Skill installer is non-blocking** → Runs in background via entrypoint.sh; failures for individual skills are logged but don't affect server. Delete `/data/.skills-installed` to force reinstall.
9. **Express 5.x** → This project uses Express 5.1, not 4.x. Route handlers return promises natively; no need for `express-async-errors`.
10. **Homebrew in Docker** → Required by some OpenClaw skills that depend on Homebrew-installed tools. The `linuxbrew` user is created specifically for this.
