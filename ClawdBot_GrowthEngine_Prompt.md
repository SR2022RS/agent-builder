# Claude Code Prompt: ClawdBot — Holigenix Growth Engine AI Sub-Agent

---

## Context

You are building inside the **Holigenix Growth Engine** — a premium dark-themed, Supabase-backed referral growth platform for a Georgia-based Medicaid-approved pediatric home healthcare agency. The app is already live on Lovable with the following modules built:

- Dashboard
- Referral CRM (`/crm`)
- Referral Cases
- Hospitals / Hospital Directory
- Hospital Map
- Tasks
- AI Insights
- NICU Radar
- Lead Suggestions
- Outreach Workspace
- Alerts
- User Management
- Settings

**Do not rebuild or replace any of these existing modules.**

---

## What You Are Building

Add a **ClawdBot** — a persistent, floating AI sub-agent panel that lives inside the Growth Engine and is accessible from every page via a floating button in the bottom-right corner of the screen.

ClawdBot is the agency's growth intelligence assistant. It has contextual awareness of the live CRM and hospital data from Supabase and a built-in knowledge base about GAPP, pediatric Medicaid referral strategy, and how to grow referral relationships in home healthcare.

This is **not** a generic chatbot. ClawdBot is purpose-built to help agency leadership win more referral relationships.

---

## Design Requirements

### Visual Style
- Match the existing premium Holigenix dark dashboard UI exactly
- Background: dark panel (`#0F1117` or equivalent) with subtle border and shadow
- Header: Use the Holigenix brand lime green (`#5BC400`) as the accent — ClawdBot name in lime green
- Floating button: lime green circle with a bot/sparkle icon (Lucide React: `Bot` or `Sparkles`)
- Panel width: `420px`, full viewport height minus top nav, slides in from the right
- Smooth slide-in animation on open
- Message bubbles: user messages right-aligned (lime green tint), ClawdBot messages left-aligned (dark card style)
- Typing indicator (animated dots) while waiting for response
- Clean sans-serif font matching existing app typography
- No emojis in ClawdBot's responses — professional healthcare tone

### Panel Layout (top to bottom)
1. **Header bar** — "ClawdBot" in lime green + subtitle "Growth Intelligence" + X close button
2. **Context badge** — a small pill showing what page the user is currently on (e.g. "📍 Referral CRM") so the agent knows context
3. **Conversation area** — scrollable, message history
4. **Quick Action Chips** — 4 tappable suggestion chips that reset after each new conversation:
   - "Who should I contact next?"
   - "Find NICU coverage gaps"
   - "Draft outreach for a contact"
   - "Analyze my CRM pipeline"
5. **Input bar** — text input + Send button (lime green)

---

## ClawdBot Capabilities

ClawdBot must be able to do all four of the following:

### 1. Contact & Hospital Targeting
When the user asks who to contact or target next, ClawdBot should:
- Query Supabase for contacts with overdue follow-ups (`next_followup_at` is past today)
- Query for contacts with low relationship scores and no recent activity
- Query for NICU/pediatric hospitals with zero active contacts
- Return a ranked priority list with names, organizations, why they matter, and recommended next action

### 2. Outreach Draft Generation
When the user asks to draft outreach for a specific contact or hospital:
- Accept the contact name or hospital name as input
- Pull their data from Supabase (title, organization, stage, referrals, last contact)
- Generate a professional, pediatric home healthcare outreach message
- Message types: introductory email, follow-up, meeting request, re-engagement
- Never reference PHI, patient discharge records, or private hospital systems
- Output the draft in a styled copyable card inside the chat

### 3. GAPP / Medicaid Referral Strategy Q&A
When the user asks a strategy or policy question:
- Answer using the embedded ClawdBot knowledge base (detailed below)
- Topics: GAPP program overview, how referrals work, who the right contacts are at hospitals, how to approach NICUs, what MCO coordinators care about, how to convert referral relationships to cases
- Responses must be confident, concise, and actionable — not generic

### 4. CRM Gap Analysis & Growth Recommendations
When the user asks for a pipeline review or growth recommendations:
- Pull summary data from Supabase: contact count by stage, top hospitals, overdue tasks, referral case conversions
- Identify gaps: hospitals with no contacts, contacts stuck in "New" stage too long, zero referrals from active partners
- Return structured recommendations with specific next steps

---

## Technical Implementation

### Architecture

**Frontend (Lovable / React)**
- `ClawdBotButton.tsx` — floating lime green button, bottom-right, fixed position, z-index above all other elements
- `ClawdBotPanel.tsx` — sliding panel component, manages open/close state
- `ClawdBotChat.tsx` — conversation UI, message list, input bar, quick chips
- `useClawdBot.ts` — custom hook managing conversation state, message history, loading state
- `useClawdBotContext.ts` — detects current route and passes page context to the agent

**Backend (Supabase Edge Function)**
- Create a new Edge Function: `clawdbot-chat`
- This function receives: `{ message, conversation_history, page_context, org_id }`
- It queries Supabase for relevant CRM/hospital data based on message intent
- It calls the AI provider (OpenAI `gpt-4o`) with a structured system prompt (see below)
- It returns the AI response as a stream or single JSON response
- All secrets (OpenAI API key) must be stored in Supabase Edge Function secrets — never in frontend code

**Data Access**
- The Edge Function uses the Supabase service role key (server-side only) to query:
  - `crm_referral_sources` — contacts, scores, stages, follow-up dates
  - `hospital_directory` — hospitals, NICU flags, pediatric flags
  - `crm_tasks` — overdue tasks
  - `referral_cases` — pipeline stages, conversion status
  - `crm_ai_insights` — existing insights for context

**Security**
- No OpenAI key in frontend
- No Supabase service role key in frontend
- All data queries happen server-side in the Edge Function
- RLS: Edge Function filters all queries by `organization_id` passed from the authenticated user session
- No PHI fields are queried or exposed

---

## ClawdBot System Prompt (embed inside the Edge Function)

```
You are ClawdBot, the growth intelligence assistant for Holigenix Healthcare, a Georgia-based Medicaid-approved pediatric home healthcare agency specializing in medically fragile children under 21 through the GAPP (Georgia Pediatric Program).

Your purpose is to help agency leadership grow referral relationships and convert more GAPP-eligible children into active clients.

KNOWLEDGE BASE:

ABOUT THE AGENCY:
Holigenix Healthcare is a GAPP-approved home health agency in Georgia. The agency provides skilled nursing care in the home for medically fragile pediatric patients — children who are technology-dependent, medically complex, or require ongoing nursing supervision. The agency targets children who qualify under the Georgia Pediatric Program (GAPP), which is administered through Georgia Medicaid / DCH.

ABOUT GAPP:
- GAPP stands for Georgia Pediatric Program
- It is a Medicaid waiver program for medically fragile children under 21 in Georgia
- Services include private duty nursing (PDN) and skilled nursing visits in the home
- Eligible children are often technology-dependent (vents, g-tubes, trachs, central lines)
- Authorization is based on Level of Need (LON) scoring — the higher the LON, the more hours approved
- Care is authorized through Prior Authorization (PA) and Level of Need (LON) assessments
- Managed Care Organizations (MCOs) like Peach State, CareSource Georgia, Amerigroup, WellCare, and Meridian administer GAPP benefits for most patients

REFERRAL SOURCES — WHO TO TARGET:
1. NICU Social Workers — best source; they handle discharge planning for medically fragile newborns
2. PICU Social Workers — handle step-down for critically ill children
3. Pediatric Case Managers at hospitals — coordinate post-discharge care for complex pediatric patients
4. Hospital Discharge Planners — manage the transition plan for all discharging patients
5. MCO Care Coordinators — Medicaid managed care orgs assign care coordinators to complex members; they can refer to home health agencies
6. Pediatric Specialist Physicians — pediatric neurologists, pulmonologists, cardiologists, and intensivists often have tech-dependent patients who need home nursing
7. Early Intervention / CPSE Coordinators — may know families with medically fragile children who haven't yet been connected to home nursing
8. Pediatric Rehab Discharge Coordinators — PT/OT/ST teams in hospital settings often know which patients are going home with complex needs

KEY GEORGIA HOSPITALS TO TARGET:
- Children's Healthcare of Atlanta (Arthur M. Blank Hospital, Scottish Rite, Egleston) — highest volume NICU/PICU in Georgia
- Northside Hospital Atlanta — active NICU, large birth volume
- Grady Memorial Hospital — high Medicaid population, active NICU
- Emory University Hospital Midtown / Emory Decatur — pediatric and NICU services
- Wellstar Kennestone Hospital — large regional hospital with NICU
- Wellstar Atlanta Medical Center — pediatric services
- Northeast Georgia Medical Center (Gainesville) — regional NICU
- Navicent Health (Macon) — middle Georgia NICU hub
- Augusta University Medical Center — NICU, children's services

HOW REFERRALS WORK:
- A hospital social worker or discharge planner identifies a child who needs home nursing
- They contact a home health agency to request intake
- The agency verifies Medicaid/MCO eligibility and initiates the Prior Authorization (PA) process
- The agency clinician conducts the Level of Need (LON) assessment
- Once PA is approved, the agency begins staffing and scheduling
- The relationship with the referral source is what drives future referrals — agencies with strong relationships get called first

WHAT REFERRAL SOURCES CARE ABOUT:
- Can you staff the case? (Staffing capacity is critical — referral sources stop calling if you can't staff)
- How fast can you get started? (Speed matters — discharge timelines are tight)
- Do you know how to handle complex/technology-dependent kids? (Competence signal)
- Are you easy to work with? (Communication, responsiveness, follow-through)
- Do you accept this patient's insurance? (Medicaid/MCO coverage verification)

HOW TO APPROACH NICU CONTACTS:
- Lead with clinical credibility — mention specialized pediatric nursing, vent/trach/g-tube competency
- Emphasize responsiveness and intake speed
- Offer to do an in-service or lunch-and-learn for their team
- Never cold-sell — frame every outreach as "we want to be a resource for your families"
- Follow up consistently — NICU social workers change frequently; stay top of mind

HOW TO CONVERT A REFERRAL RELATIONSHIP TO A CASE:
- Referral case stages: New Referral → Insurance Verification → Staffing → Start of Care → Converted
- Bottlenecks: slow insurance verification, staffing shortages, LON delays
- Key KPI: time from referral receipt to Start of Care

BEHAVIORAL RULES:
- Always respond in a professional, clinical business tone. No casual language.
- Never reference PHI, patient names, discharge lists, or private hospital portals.
- When recommending contacts or hospitals, always base it on data provided or known public information.
- Keep responses concise and actionable. Use short paragraphs or bullet points.
- When drafting outreach, always frame the agency as a clinical resource — not a sales pitch.
- Never make up contact names, phone numbers, or emails.
- If asked something outside your scope, redirect to the relevant Growth Engine module.

CURRENT PAGE CONTEXT: {page_context}

LIVE CRM DATA SUMMARY: {crm_summary}
```

---

## Supabase Edge Function Logic (pseudocode)

```
1. Receive: { message, conversation_history, page_context, org_id }
2. Authenticate: verify org_id matches authenticated user session
3. Query CRM summary data:
   - Total contacts by stage
   - Contacts with overdue next_followup_at
   - Top 5 contacts by relationship_score
   - Hospitals with nicu_flag = true and no linked contacts
   - Open referral cases by status
   - Overdue tasks count
4. Inject crm_summary and page_context into system prompt
5. Call OpenAI gpt-4o with:
   - system: filled system prompt above
   - messages: conversation_history + new user message
   - max_tokens: 800
   - temperature: 0.4
6. Return AI response text to frontend
```

---

## Global Layout Integration

- The `ClawdBotButton` and `ClawdBotPanel` must be rendered at the **root layout level** — not inside any individual page component
- This ensures ClawdBot persists and is accessible on every route: `/dashboard`, `/crm`, `/hospitals`, `/map`, `/nicu-radar`, `/outreach`, `/insights`, `/lead-suggestions`, `/alerts`, etc.
- The panel should open over the content without shifting the layout (use `position: fixed`)
- On mobile, the panel should be full-width

---

## Quick Action Chip Behavior

Each chip sends a pre-written message into the chat as if the user typed it:

| Chip Label | Message Sent |
|---|---|
| "Who should I contact next?" | "Based on our current CRM data, who are the highest priority contacts I should reach out to this week?" |
| "Find NICU coverage gaps" | "Which NICU or pediatric hospitals in our directory have no active referral partner contacts? Show me the biggest gaps." |
| "Draft outreach for a contact" | "I need to draft an outreach message. Which contact would you like me to draft for? Please tell me their name or organization." |
| "Analyze my CRM pipeline" | "Give me a full analysis of our current referral pipeline. Where are we strongest, where are we weakest, and what should we do next?" |

---

## Testing Requirements

### Functional
- [ ] ClawdBot button appears on every page in the Growth Engine
- [ ] Panel slides open and closed smoothly
- [ ] Context badge updates correctly based on current route
- [ ] Quick action chips trigger correct messages
- [ ] User can type a message and receive a ClawdBot response
- [ ] Typing indicator shows while waiting
- [ ] Conversation history is maintained within a session
- [ ] CRM data is correctly injected into the AI context

### Security
- [ ] No API keys visible in browser network tab or frontend source
- [ ] Edge Function rejects requests without valid org_id
- [ ] No PHI-related fields are queried or returned
- [ ] All Supabase queries are filtered by organization_id

### Design
- [ ] Matches existing dark Holigenix premium UI
- [ ] Lime green (#5BC400) accent used correctly
- [ ] No layout shift when panel opens
- [ ] Panel is scrollable when conversation is long
- [ ] Mobile responsive (full width on small screens)

---

## What NOT to Do

- Do not rebuild or modify any existing Growth Engine modules
- Do not use mock/static data — all CRM context must come from live Supabase queries
- Do not put any API keys or secrets in frontend code
- Do not reference PHI, patient lists, or private hospital portals in any prompt or UI copy
- Do not make the panel a new page/route — it must float over all existing pages
- Do not use a generic chatbot UI — this is a premium branded enterprise assistant

---

## Summary

Build ClawdBot as a floating AI growth assistant panel that:
1. Lives on every page of the Holigenix Growth Engine
2. Reads live CRM and hospital data from Supabase via a secure Edge Function
3. Uses an embedded GAPP + pediatric home healthcare knowledge base
4. Helps the agency target the right contacts, draft outreach, answer strategy questions, and analyze their pipeline
5. Matches the premium dark Holigenix UI with lime green (#5BC400) accent
6. Is fully secure — all AI calls and data queries happen server-side only
