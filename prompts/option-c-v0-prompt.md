# Vercel v0 Prompt — Option C: Secret Vault Service

Paste everything below the line into Vercel v0:

---

Create a single-page dark-themed artifact titled **"Option C: Secret Vault Service"** for an API key security guide. This is the recommended option (highest security). Match this exact visual style: dark background (#0d1117), cards with colored left borders, step numbers in purple circles, code blocks with syntax highlighting, and badge pills.

## Layout & Style

- Background: `#0d1117`, cards: `#1c2128`, borders: `#30363d`
- Text: primary `#e6edf3`, secondary `#8b949e`, muted `#6e7681`
- Accent colors: green `#3fb950`, blue `#58a6ff`, purple `#bc8cff`, cyan `#39d2c0`, orange `#d29922`, red `#f85149`
- Font: system sans-serif stack, code in monospace
- Max width 720px, centered, mobile-responsive
- Cards have 12px border-radius, 20px padding, 1px solid border
- No external dependencies — pure HTML + inline CSS

## Content Structure

### Header
- Title: "Option C: Secret Vault Service" with a small "RECOMMENDED" green badge next to it
- Subtitle examples: "1Password Secrets, Infisical, Doppler"
- Meta row: "Best for: Teams, client deployments, production"
- Two badge pills: "Effort: Medium" (purple) and "Security: Highest" (cyan)

### Card 1 — "Why Use a Vault?" (purple left border)
Bulleted list:
- **Centralized control** — one place to manage all secrets across every project and environment
- **Automatic rotation** — schedule key rotation without redeploying
- **Audit trail** — full log of who accessed which secret and when
- **Access control** — grant per-project, per-team, or per-environment permissions
- **Zero plaintext** — secrets are never stored in files, env vars, or git history

### Card 2 — "Setup Steps" (cyan left border)
7 numbered steps with purple circle step numbers:

**Step 1: Choose your vault provider**
Show a 3-column comparison grid:
| Free Tier: **1Password** — Best for teams already using 1Password |
| Open Source: **Infisical** — Self-hostable, great for full control |
| Easiest DX: **Doppler** — Best CLI & integrations out of the box |

**Step 2: Create a project and environments**
Description: "Set up separate environments (dev, staging, production) so each stage pulls its own keys."
Code block:
```
# Doppler example
doppler projects create my-ai-agent
doppler environments create --project my-ai-agent dev
doppler environments create --project my-ai-agent production

# Infisical example
infisical init
# Follow prompts to select org → project → environment
```

**Step 3: Add your secrets to the vault**
Code block with examples for all 3 providers:
```
# Doppler
doppler secrets set OPENAI_API_KEY=sk-proj-xxx --project my-ai-agent --config production
doppler secrets set ANTHROPIC_API_KEY=sk-ant-xxx --project my-ai-agent --config production

# Infisical
infisical secrets set OPENAI_API_KEY=sk-proj-xxx --env=prod
infisical secrets set ANTHROPIC_API_KEY=sk-ant-xxx --env=prod

# 1Password CLI
op item create --category=api_credential \
  --title="OpenAI Production" \
  --vault="AI Agent Keys" \
  "credential=sk-proj-xxx"
```

**Step 4: Inject secrets at runtime (no .env needed)**
Code block:
```
# Doppler — wraps your process and injects env vars
doppler run --project my-ai-agent --config production -- node server.js

# Infisical — same concept
infisical run --env=prod -- node server.js

# 1Password — uses secret references
op run --env-file=.env.tpl -- node server.js

# .env.tpl (1Password template)
OPENAI_API_KEY=op://AI Agent Keys/OpenAI Production/credential
```

**Step 5: Connect to your deployment platform**
Description: "All three providers offer native integrations with Railway, Vercel, AWS, and GitHub Actions."
Code block:
```
# Doppler → Railway integration
# 1. Go to Doppler dashboard → Integrations → Railway
# 2. Authorize and select project + environment
# 3. Secrets auto-sync on every deploy

# Infisical → GitHub Actions example
- uses: Infisical/secrets-action@v1
  with:
    env: production
    projectId: ${{ secrets.INFISICAL_PROJECT_ID }}
```

**Step 6: Set up automatic key rotation**
Description: "Configure rotation schedules so keys are cycled without manual intervention."
Code block:
```
# Doppler: rotation is configured per-secret in dashboard
# Settings → Secret → Enable Rotation → Set interval (e.g., 90 days)

# Infisical: use the rotation API
infisical secrets rotation create \
  --secret-name OPENAI_API_KEY \
  --interval 90d \
  --env=prod

# 1Password: set expiry reminders, rotate manually or via Connect API
```

**Step 7: Grant team access with least privilege**
Description: "Add team members with scoped roles — developers see dev secrets, only ops sees production."
Code block:
```
# Doppler
doppler team members add dev@team.com --role=viewer --project my-ai-agent --config dev
doppler team members add ops@team.com --role=admin --project my-ai-agent --config production

# Infisical
# Dashboard → Members → Add → Assign role per environment
```

### Tip Box (green left border, green "PRO TIP" label)
- **Solo + simple?** Start with **Doppler** — best CLI, 5-minute setup, generous free tier
- **Team + compliance?** Use **Infisical** — open source, self-hostable, full audit logs
- **Already use 1Password?** Add the **Secrets Automation** add-on — no new tool to learn

### Info Box (blue left border, blue "HOW IT WORKS IN PRACTICE" label)
"Your code stays identical to Option A or B — it still reads `process.env.OPENAI_API_KEY`. The vault CLI wraps your process and injects secrets as environment variables at startup. No code changes needed. The difference is that secrets live in an encrypted vault with access controls, rotation, and audit logs — not in a flat file or platform dashboard."

### Footer
Centered, muted text: "Built for the **AI Junkies** cohort · Presented by @aisniper007 · AI Marvels / EmergeStack Development Company"
"AI Junkies" in green, @aisniper007 as a green link.
