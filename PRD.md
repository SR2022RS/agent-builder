# Agent Builder — Product Requirements Document

**Version:** 1.0
**Date:** 2026-03-25
**Owner:** Rodney Williams, Holigenix LLC
**Status:** Live (deployed on Railway)

---

## 1. Executive Summary

The **Agent Builder** is a one-click deployment platform that turns any GoHighLevel (GHL) account into a fully autonomous AI-powered CRM. Built on OpenClaw and hosted on Railway, it gives any business — from marketing agencies to Airbnb operators — an AI employee that lives inside their GHL account, handles lead follow-up, manages pipelines, books appointments, sends messages, and runs scheduled automations 24/7.

**What makes it different from Zapier/Make/etc.:**
- Not trigger-action automation. The agent thinks, decides, and acts based on goals.
- Full read AND write access to GHL (not just read-only).
- Cron jobs for proactive automation (not just reactive webhooks).
- Adapts its persona, tone, and workflows to any business vertical.
- Pre-loaded with 71 curated skills for marketing, sales, communication, scheduling, and more.

---

## 2. Problem Statement

Small business owners and agencies on GoHighLevel spend hours daily on repetitive CRM tasks:
- Manually responding to inbound leads (slow response = lost deals)
- Moving contacts through pipeline stages by hand
- Forgetting to follow up on stale leads
- Manually booking appointments and sending reminders
- Running reports by exporting data and building spreadsheets

Existing solutions (Zapier, GHL workflows, chatbots) are rigid if/then automations that break when edge cases appear. They can't reason, adapt, or make judgment calls.

**The Agent Builder solves this** by deploying an AI agent that operates like a real employee inside GHL — reading context, making decisions, taking actions, and learning from the business's specific needs.

---

## 3. Target Users

| User Type | Use Case |
|---|---|
| **Agency owners** | Deploy AI agents for client sub-accounts, manage at scale |
| **Small business operators** | Stop doing manual CRM work, let AI handle lead follow-up |
| **Real estate investors** | Automated lead qualification, pipeline management, appointment booking |
| **Short-term rental / Airbnb operators** | Guest communication, booking optimization, turnover coordination |
| **Home services businesses** | Speed-to-lead for HVAC, plumbing, roofing, etc. |
| **Healthcare / Med Spa** | Patient intake, appointment reminders, follow-up |
| **Coaches / Consultants** | Prospect qualification, discovery call booking |
| **E-commerce brands** | Customer support, order tracking, re-engagement |
| **Any GHL user** | The platform adapts to any business vertical |

---

## 4. Product Architecture

### 4.1 System Overview

```
┌─────────────────────────────────────────────────────┐
│                    RAILWAY (Cloud)                    │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │           Express Wrapper (server.js)            │ │
│  │                                                   │ │
│  │  /setup/* ──► Setup Wizard (browser-based)       │ │
│  │  /api/deploy-file ──► Provisioning API           │ │
│  │  /* ──► Reverse Proxy ──┐                        │ │
│  │                          ▼                        │ │
│  │              OpenClaw Gateway (:18789)            │ │
│  │              ├── Agent Runtime                    │ │
│  │              ├── Control UI (/openclaw)           │ │
│  │              ├── MCP Server Connections           │ │
│  │              │   └── GoHighLevel MCP              │ │
│  │              ├── Channel Integrations             │ │
│  │              │   ├── Telegram                     │ │
│  │              │   ├── Discord                      │ │
│  │              │   └── Slack                        │ │
│  │              └── 71 Pre-installed Skills          │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  Volume (/data)                                       │
│  ├── .openclaw/ (config, credentials, gateway token) │
│  └── workspace/ (skills, memory, sessions)           │
└─────────────────────────────────────────────────────┘
          │                          │
          ▼                          ▼
   GoHighLevel API v2         Messaging Channels
   (MCP / HTTP Streamable)    (Telegram, Discord, Slack)
```

### 4.2 Request Flow

1. **User/Browser → Railway public domain** (HTTPS)
2. **Express wrapper** routes:
   - `/setup/*` → Setup wizard (protected by SETUP_PASSWORD)
   - Everything else → Reverse proxy to internal gateway
3. **Proxy injects Bearer token** into every request (HTTP + WebSocket)
4. **OpenClaw gateway** processes requests via agent runtime
5. **Agent uses MCP tools** to interact with GoHighLevel CRM
6. **Agent uses skills** for marketing, outreach, scheduling, etc.

### 4.3 Authentication Layers

| Layer | Method | Purpose |
|---|---|---|
| Setup wizard | Basic Auth (SETUP_PASSWORD) | Protect onboarding UI |
| Gateway proxy | Bearer token (auto-injected) | Authenticate with OpenClaw gateway |
| GHL MCP | Bearer token (GHL PIT) | Authenticate with GoHighLevel API |
| Deploy API | Bearer token (SETUP_PASSWORD) | Protect file provisioning endpoint |
| Control UI | Token in URL hash fragment | Browser SPA auth to gateway WebSocket |

---

## 5. Core Features

### 5.1 Browser-Based Setup Wizard

**Endpoint:** `/setup`

Users configure everything through a web form — no CLI, no SSH, no code.

| Step | What It Does |
|---|---|
| 1. Model/Auth Provider | Select LLM provider (OpenAI, Anthropic, Google, OpenRouter, etc.) and auth method |
| 2. GoHighLevel Integration | Enter GHL Private Integration Token + Location ID |
| 3. Channels (optional) | Connect Telegram, Discord, and/or Slack bots |
| 4. Run Onboarding | One click → runs `openclaw onboard`, writes config, starts gateway |

**Supported LLM Providers (12):**
OpenAI, Anthropic (Claude), Google (Gemini), OpenRouter, Vercel AI Gateway, Moonshot AI, Z.AI, MiniMax, Qwen, GitHub Copilot, Synthetic, OpenCode Zen

### 5.2 GoHighLevel MCP Integration

**Endpoint:** `https://services.leadconnectorhq.com/mcp/`
**Transport:** HTTP Streamable (MCP protocol)
**Auth:** Bearer token (Private Integration Token)

The agent gets direct read/write access to GHL through 36+ MCP tools (expanding to 250+):

| Category | Capabilities |
|---|---|
| **Contacts & CRM** | Search, create, update, upsert, tag/untag, manage tasks and notes |
| **Conversations** | Send SMS/email/WhatsApp, read threads, search history, auto-reply |
| **Calendars** | Check availability, book appointments, manage events and groups |
| **Pipelines** | Create/update opportunities, move stages, pull snapshots |
| **Payments** | Look up orders, list transactions, flag issues |
| **Social Media** | Create/schedule posts, pull analytics, manage accounts |
| **Blogs** | Create/update posts, categories, author profiles |
| **Email Templates** | Retrieve and create templates for campaigns |
| **Location/Custom Fields** | Pull sub-account details and field definitions |

**Rate Limits:** 100 requests/10 seconds, 200,000/day per location

**Connection Methods:**
1. **Setup wizard** — enter token + location ID in the UI
2. **Railway env vars** — set `GHL_PRIVATE_TOKEN` (or `GHL_ACCOUNT_TOKEN` or `GHL_API_KEY`) + `GHL_LOCATION_ID`
3. **Auto-injection** — if env vars are set, MCP config is injected on every gateway start (survives resets)

### 5.3 Adaptive Business Persona

The agent doesn't operate as a generic bot. During onboarding, it asks:
1. Business name and contact info
2. Industry/niche
3. Services offered and pricing
4. Target customer profile
5. Booking process (calendar link, discovery call, in-person, etc.)
6. Tone preference (casual, professional, clinical, friendly)
7. Specific automations wanted

Then it adapts its personality, qualification questions, objection handling, and CRM workflows to match.

### 5.4 Pre-Installed Skill Library (71 Skills)

Installed automatically on first boot from the OpenClaw marketplace:

| Category | Count | Key Skills |
|---|---|---|
| **Marketing & Sales** | 26 | Cold outreach, copywriting, lead magnets, pricing psychology, go-to-market, email marketing, content creation, brand voice, Meta ads reporting, sentiment scoring |
| **Communication & Outreach** | 13 | Phone caller, outbound calls, SMTP email sender, email auto-reply, testimonial collector, meeting coordinator, social media posting, Bluesky |
| **Calendar & Scheduling** | 8 | Google Calendar integration, scheduling, datetime handling, meeting prep, advanced calendar |
| **Search & Research** | 5 | Ads manager, subreddit scout, JTBD analyzer, PostHog analytics, Windsor AI |
| **E-Commerce** | 7 | Shopify integration, Amazon competitor analysis, product visuals, digital products, price watcher |
| **Productivity & CRM** | 5 | WorkCRM, Attio integration, kvCORE MCP, invoice templates |
| **Data & Social Automation** | 6 | Social media lead gen, TikTok viral marketing, Facebook/LinkedIn/Twitter/Threads posting |

### 5.5 Scheduled Automation (Cron Jobs)

The agent runs proactive tasks on recurring schedules:

| Frequency | Automations |
|---|---|
| **Hourly** | Check for unread conversations and auto-respond; Audit lead response times |
| **Daily** | Re-engage stale leads (48h no response); Pipeline hygiene (stuck deals); Send appointment reminders; Sync new GHL contacts with proper tags |
| **Weekly** | Pipeline reports (deals by stage, conversion rates); Lead source analysis; No-show re-engagement; Cold lead revival (30+ days inactive) |
| **Monthly** | Revenue summary (closed deals, average deal size); Contact list cleanup (invalid info, duplicates, disengaged) |

### 5.6 Multi-Channel Messaging

| Channel | Setup Method | Capabilities |
|---|---|---|
| **Telegram** | Bot token via setup wizard | DM conversations, group messaging (allowlist), pairing-based auth |
| **Discord** | Bot token via setup wizard | DM conversations, server messaging (allowlist), requires MESSAGE CONTENT INTENT |
| **Slack** | Bot + App tokens via setup wizard | Workspace messaging |
| **GHL SMS** | Via MCP connection | Send/receive SMS through GHL phone numbers |
| **GHL Email** | Via MCP connection | Send/receive email through GHL |
| **GHL WhatsApp** | Via MCP connection | Send/receive WhatsApp through GHL |

### 5.7 Backup & Portability

**Endpoint:** `/setup/export`

One-click download of complete agent state as `.tar.gz`:
- Configuration files (openclaw.json, gateway token)
- Credentials and sessions
- Workspace (skills, memory files, custom agents)
- Preserves directory structure for easy restore

### 5.8 Provisioning API

**Endpoint:** `POST /api/deploy-file`
**Auth:** Bearer token (SETUP_PASSWORD)

Accepts hex-encoded file content and writes to the container filesystem. Used by external provisioning engines to deploy workspace files, skills, and custom configurations without SSH access.

---

## 6. Technical Specifications

### 6.1 Stack

| Component | Technology |
|---|---|
| **Runtime** | Node.js 22 (Bookworm) |
| **Framework** | Express.js |
| **Proxy** | http-proxy (HTTP + WebSocket) |
| **Agent Platform** | OpenClaw (built from source) |
| **Build Tool** | pnpm + Bun (for OpenClaw build) |
| **Container** | Docker (multi-stage build) |
| **Hosting** | Railway (with persistent Volume at /data) |
| **Package Manager** | Homebrew (Linux, for skill dependencies) |
| **LLM Providers** | OpenAI, Anthropic, Google, OpenRouter, + 8 more |
| **CRM** | GoHighLevel API v2 (MCP protocol) |
| **Integrations** | Composio (Gmail, Google Drive) |

### 6.2 Environment Variables

**Required:**
| Variable | Description |
|---|---|
| `SETUP_PASSWORD` | Protects /setup wizard and deploy API |
| `OPENCLAW_STATE_DIR` | Config/credentials storage (must be /data/.openclaw for Railway) |
| `OPENCLAW_WORKSPACE_DIR` | Agent workspace (must be /data/workspace for Railway) |

**GHL Integration:**
| Variable | Description |
|---|---|
| `GHL_PRIVATE_TOKEN` | GHL Private Integration Token (also accepts `GHL_ACCOUNT_TOKEN`, `GHL_API_KEY`) |
| `GHL_LOCATION_ID` | GHL sub-account Location ID |

**Recommended:**
| Variable | Description |
|---|---|
| `OPENCLAW_GATEWAY_TOKEN` | Stable Bearer token for gateway auth (auto-generated if unset) |
| `COMPOSIO_CONSUMER_KEY` | Composio API key for Gmail/Drive integrations |

**Optional:**
| Variable | Default | Description |
|---|---|---|
| `PORT` | 8080 | Wrapper HTTP port |
| `INTERNAL_GATEWAY_PORT` | 18789 | Internal gateway port |
| `OPENCLAW_ENTRY` | /openclaw/dist/entry.js | CLI entry point path |
| `OPENCLAW_TEMPLATE_DEBUG` | false | Verbose token/gateway logging |

### 6.3 Docker Build

**Stage 1 — OpenClaw from source:**
- Clones OpenClaw repo at pinned version (`OPENCLAW_GIT_REF=v2026.3.13-1`)
- Patches extension package.json files (relaxes version constraints)
- Builds with pnpm + Bun
- Builds Control UI

**Stage 2 — Runtime:**
- Node.js 22 production image
- System dependencies: git, build-essential, Python 3, Homebrew
- Copies built OpenClaw from Stage 1
- Creates `/usr/local/bin/openclaw` CLI wrapper
- Entrypoint: starts server, then launches skill installer in background

### 6.4 Railway Configuration

| Setting | Value |
|---|---|
| Builder | Dockerfile |
| Start Command | ./entrypoint.sh |
| Health Check | /setup/healthz (300s timeout) |
| Restart Policy | on_failure |
| Volume | Mounted at /data |
| Public Networking | Enabled (*.up.railway.app domain) |

---

## 7. Current Deployment (Agent Builder Project)

| Property | Value |
|---|---|
| **Railway Project** | Agent Builder |
| **Service** | openclaw-railway-template |
| **Domain** | openclaw-railway-template-production-39ef.up.railway.app |
| **Region** | asia-southeast1 |
| **GitHub Repo** | SR2022RS/openclaw-railway-template |
| **OpenClaw Version** | v2026.3.13-1 |
| **GHL Location** | db8OiFm3tCQiPI1P9VkD |
| **GHL Token** | PIT configured (GHL_ACCOUNT_TOKEN) |

---

## 8. Roadmap / Enhancement Opportunities

### 8.1 Near-Term
- [ ] **Multi-tenant support** — Single deployment managing multiple GHL sub-accounts
- [ ] **Business config persistence** — Store onboarding answers (business name, niche, tone) in workspace memory files so agent retains persona across restarts
- [ ] **GHL webhook listener** — Receive real-time events from GHL (new lead, form submission, appointment booked) instead of polling
- [ ] **Custom pipeline templates** — Pre-built pipeline stage configurations per vertical
- [ ] **Onboarding wizard v2** — Step-by-step guided flow with vertical-specific questions

### 8.2 Mid-Term
- [ ] **White-label deployments** — Agency owners deploy branded instances for clients
- [ ] **Dashboard/analytics UI** — Visual pipeline, lead response metrics, conversion funnels
- [ ] **Voice AI integration** — Connect GHL Voice AI for inbound/outbound call handling
- [ ] **Workflow builder** — Visual editor for custom cron job automation recipes
- [ ] **Skill marketplace integration** — Browse and install skills from the setup wizard UI

### 8.3 Long-Term
- [ ] **SaaS billing layer** — Stripe/LemonSqueezy integration for subscription management
- [ ] **Multi-agent orchestration** — Multiple specialized agents per GHL account (lead gen agent, support agent, billing agent)
- [ ] **Training/fine-tuning** — Custom model fine-tuning based on business conversation history
- [ ] **Mobile app** — Push notifications, quick approvals, pipeline overview on mobile
- [ ] **API for external integrations** — REST API for third-party tools to interact with the agent

---

## 9. Known Limitations

| Limitation | Detail |
|---|---|
| **GHL API rate limits** | 100 req/10s, 200K/day per location |
| **GHL MCP tools** | Currently 36 tools; GHL expanding to 250+ |
| **Single agent per deployment** | One OpenClaw instance = one agent persona |
| **No real-time GHL webhooks** | Agent polls for new data via cron; no push notifications from GHL yet |
| **Skill install reliability** | Some marketplace skills fail to install; script continues past failures |
| **OpenClaw version pinning** | Must manually update `OPENCLAW_GIT_REF` in Dockerfile for upgrades |
| **Channel config fragility** | Uses direct config writes instead of CLI (workaround for flaky `channels add`) |
| **No GUI for cron management** | Cron jobs defined in system prompt, not a visual editor |

---

## 10. Security Considerations

| Area | Implementation |
|---|---|
| **Setup wizard** | Password-protected (Basic Auth) |
| **Gateway auth** | Bearer token auto-injected; never exposed to browser |
| **GHL credentials** | Stored in Railway env vars (encrypted at rest); injected into config at runtime |
| **Token persistence** | Gateway token file written with mode 0600 |
| **Control UI** | Device pairing disabled (wrapper handles auth); allowed origins restricted to Railway domain |
| **Deploy API** | Bearer auth required; hex-encoded payloads only |
| **No third-party proxies** | Direct connection to GHL MCP endpoint — no middleman services |
