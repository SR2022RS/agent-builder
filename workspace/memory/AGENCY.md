# AGENCY.md — Holigenix Healthcare LLC
> Last updated: 2026-03-22

## Identity
| Field | Value |
|-------|-------|
| **Legal Name** | Holigenix Healthcare LLC |
| **Type** | Medicaid-approved pediatric home healthcare agency |
| **State** | Georgia |
| **Certification** | GAPP (Georgia Pediatric Program) approved |
| **Admin Email** | admin@holigenixhealthcare.com |
| **Website** | holigenixhealthcare.com |
| **Growth Engine** | homehealthcareleads.com |
| **CarePortal** | clientportal.holigenixhealthcare.com |
| **Owner/CEO** | Rodney Williams |

## Services
- **Private Duty Nursing (PDN)** — skilled nursing care in the home for medically fragile children
- **Skilled Nursing Visits** — periodic nursing assessments and interventions
- **Patient Population** — medically fragile children under 21
- **Specialties** — technology-dependent children: ventilators, tracheostomies, gastrostomy tubes, central lines

## Payer Mix
- Georgia Medicaid (fee-for-service)
- Managed Care Organizations (CMOs) — **3 active GA Medicaid CMOs as of 2026**:
  - **Peach State Health Plan** (Centene) — largest, Home Health Auth: 1-800-704-1483
  - **CareSource Georgia** — growing, Provider Relations: GAProviderRelations@CareSource.com
  - **Amerigroup Georgia** (Elevance/Anthem) — sole CMO for Georgia Families 360 (foster care)
- NOTE: WellCare was absorbed into Peach State (Centene acquisition). Meridian does not operate in GA Medicaid.
- New CMO contracts expected July 1, 2026 (UnitedHealthcare entering GA)

## Competitive Advantages
1. **GAPP specialization** — deep expertise in Georgia's pediatric Medicaid program
2. **Technology-dependent focus** — specialized in the most complex cases (vents, trachs, g-tubes)
3. **Speed to intake** — fast response from referral receipt to start of care
4. **Staffing reliability** — ability to staff complex cases when competitors cannot
5. **AI-powered growth** — systematic CRM-driven approach to referral development (Growth Engine + Scout + Aria)
6. **Dual-platform operations** — CarePortal for clinical ops, Growth Engine for business development

## Service Area
### Primary
- Metro Atlanta and surrounding counties
- Key hospital systems: Children's Healthcare of Atlanta, Northside, Grady, Emory, Wellstar

### Secondary / Expansion
- Northeast Georgia (Gainesville, Athens)
- Middle Georgia (Macon — Navicent Health)
- Augusta (Augusta University Medical Center)
- South Georgia (emerging)

## Tech Stack
| System | Purpose | URL |
|--------|---------|-----|
| Growth Engine (Vercel) | Referral CRM + dashboard | holigenix-growth-engine.vercel.app |
| Growth Engine (Domain) | Production domain | homehealthcareleads.com |
| CarePortal (Vercel) | Clinical operations portal | clientportal.holigenixhealthcare.com |
| Supabase | Database + Edge Functions + Auth | shrxkkbgmckbezmlssbg.supabase.co |
| Railway | OpenClaw agent hosting (Scout) | openclaw-railway-template-pu92-production.up.railway.app |
| Composio | Gmail, Google Drive, Telegram integrations | Connected via MCP |
| n8n | Workflow automation | Connected |
| GitHub | Source code (SR2022RS org) | github.com/SR2022RS |

## Agent Ecosystem
| Agent | Platform | Purpose |
|-------|----------|---------|
| **Scout** | Telegram (OpenClaw/Railway) | Research & intelligence — CRM analysis, hospital targeting, pipeline strategy, GAPP expertise |
| **Outreach Agent** | n8n + Gmail/Composio | Marketing & outreach — email campaigns, follow-up sequences, re-engagement, sends from admin@holigenixhealthcare.com |
| **Aria** | Growth Engine web panel | In-app growth intelligence assistant |
| **Ava** | CarePortal + Telegram | Clinical operations assistant |
| **CareOps** | CarePortal Command Center | Agency diagnostics and compliance |
