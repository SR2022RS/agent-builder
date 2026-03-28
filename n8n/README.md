# Holigenix n8n Workflows

## Outreach Agent — Daily Email Campaigns

**File**: `holigenix-outreach-workflow.json`

Automated outreach workflow that drafts personalized emails via Claude and sends them to hospital referral sources via Gmail.

### Flow

```
[Weekday 9am ET] ──┐
                    ├──> Config ──> Fetch Due Contacts ──> Has Contacts? ──> Draft Emails (Claude) ──> Send & Log
[Manual Trigger] ───┘
```

### Nodes

| Node | Type | What it does |
|------|------|-------------|
| Weekday 9am ET | Schedule | Fires Mon-Fri at 9am Eastern |
| Manual Trigger | Manual | For on-demand test runs |
| Config | Code | API keys, sender info, DRY_RUN flag |
| Fetch Due Contacts | Code | Queries Supabase `crm_referral_sources` + `outreach_emails`, applies cadence rules, returns prioritized batch |
| Has Contacts Due? | Filter | Stops execution if no contacts need outreach |
| Outreach Agent — Draft Emails | Code | Calls Claude API per contact with full Outreach Agent system prompt, returns JSON drafts |
| Send & Log Emails | Code | Sends via Gmail API, logs to `outreach_emails` table, updates contact `last_contacted_at` |

### Cadence Rules (built into Fetch Due Contacts)

| Stage | Message Type | Timing |
|-------|-------------|--------|
| New (never contacted) | Introductory | Immediate |
| Contacted (no response) | Follow-up | Every 10-14 days, max 3 |
| Engaged (responded) | Nurture | Every 7-10 days |
| Active Partner | Thank you | Every 14-21 days |
| Cold (went quiet) | Re-engagement | At 30 days, then monthly |
| Exhausted (3+ no reply) | SKIP | Do not email |

### Setup

1. **Run the Supabase migration**:
   - Open Supabase SQL Editor for project `shrxkkbgmckbezmlssbg`
   - Run `outreach-emails-migration.sql`

2. **Import the workflow into n8n**:
   - Go to n8n dashboard → Workflows → Import from File
   - Select `holigenix-outreach-workflow.json`

3. **Configure the Config node** — replace placeholders:
   - `YOUR_HOLIGENIX_SUPABASE_SERVICE_KEY` → Supabase service role key
   - `YOUR_ANTHROPIC_API_KEY` → Claude API key
   - `YOUR_GMAIL_OAUTH_ACCESS_TOKEN` → Gmail OAuth token

4. **Test in DRY_RUN mode**:
   - Leave `DRY_RUN: true` (default)
   - Click Manual Trigger → Execute
   - Check output: drafts will be generated and logged but NOT sent

5. **Go live**:
   - Set `DRY_RUN: false` in Config node
   - Activate the workflow (toggle on)
   - Emails send Mon-Fri at 9am ET, max 5 per run

### Gmail OAuth Setup

To send emails, you need a Gmail OAuth access token:

1. Create a Google Cloud project with Gmail API enabled
2. Create OAuth 2.0 credentials (Web application type)
3. Authorize with `admin@holigenixhealthcare.com` account
4. Use the access token in the Config node

For long-term use, implement token refresh or use n8n's built-in Gmail credential (swap the Code-based send for an Email Send node).

### Dependencies

- **Supabase tables**: `crm_referral_sources`, `hospital_directory`, `outreach_emails`
- **APIs**: Anthropic (Claude Sonnet), Gmail v1
- **Model**: `claude-sonnet-4-20250514` (configurable in Draft Emails node)
