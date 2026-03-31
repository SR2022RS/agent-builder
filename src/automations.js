// =============================================================================
// DVTOL Automations — Pipeline monitoring, USPS tracking, daily summary
// Runs inside BRIDGE (or any agent with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
//
// Cost-optimized: bulk alerts go via GHL email (zero LLM cost), NOT individual
// Telegram messages. Telegram reserved for urgent single events only.
// =============================================================================

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VANCE_URL = process.env.VANCE_ENDPOINT || "";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_GROUP_CHAT_ID = process.env.TELEGRAM_GROUP_CHAT_ID || "";
const GHL_API_KEY = process.env.GHL_PIT_TOKEN || process.env.GHL_PRIVATE_TOKEN || process.env.GHL_API_KEY || "";
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || "";
// GHL contact IDs for alert email recipients (comma-separated)
const GHL_ALERT_CONTACT_IDS = (process.env.GHL_ALERT_CONTACT_IDS || "").split(",").map(s => s.trim()).filter(Boolean);
const SHIPENGINE_API_KEY = process.env.SHIPENGINE_API_KEY || process.env.SHIPENGINE_API || "";
const DVTOL_SHIP_FROM = {
  name: process.env.DVTOL_SHIP_FROM_NAME || "Dr. V's Tree of Life",
  address_line1: process.env.DVTOL_SHIP_FROM_ADDRESS || "",
  city_locality: process.env.DVTOL_SHIP_FROM_CITY || "",
  state_province: process.env.DVTOL_SHIP_FROM_STATE || "",
  postal_code: process.env.DVTOL_SHIP_FROM_ZIP || "",
  country_code: "US",
};
const AUTHORIZED_TELEGRAM_IDS = (process.env.AUTHORIZED_TELEGRAM_IDS || "").split(",").map(s => s.trim()).filter(Boolean);

// Only initialize if Supabase is configured
const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

// ─── Constants ───────────────────────────────────────────────────────────

const STAGE_NAMES = {
  1: "Full Donation Made", 2: "PMA Intake Form", 3: "Branding Form",
  4: "Logo Created", 5: "Agreement + SOF Sent", 6: "Docs Returned via USPS",
  7: "Banking Docs Sent", 8: "Banking Appointment Set", 9: "Bank Account Opened",
  10: "14 Files Sent", 11: "Done",
};

const THRESHOLDS = {
  1: { alert: 1, escalation: 2, owner: "Cathy + Janail" },
  2: { alert: 2, escalation: 4, owner: "Cathy" },
  3: { alert: 2, escalation: 3, owner: "LaRen" },
  4: { alert: 1, escalation: 2, owner: "Janail" },
  5: { alert: 3, escalation: 10, owner: "Cathy" },
  6: { alert: 1, escalation: 2, owner: "Janail" },
  7: { alert: 2, escalation: 4, owner: "Cathy" },
  8: { alert: 1, escalation: null, owner: "Cathy" },
  9: { alert: 2, escalation: 5, owner: "Cathy" },
  10: { alert: 1, escalation: null, owner: "Janail" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────

function daysBetween(date1, date2) {
  return Math.floor((date2 - date1) / (1000 * 60 * 60 * 24));
}

/**
 * Send a Telegram message — ONLY for urgent single events (new member, label).
 * Do NOT use for bulk alerts.
 */
async function sendTelegram(text) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log("[automations] Telegram not configured, skipping");
    return;
  }

  const targets = TELEGRAM_GROUP_CHAT_ID
    ? [TELEGRAM_GROUP_CHAT_ID]
    : AUTHORIZED_TELEGRAM_IDS;

  if (targets.length === 0) return;

  for (const chatId of targets) {
    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      console.error(`[automations] Telegram send failed: ${err.message}`);
    }
  }
  console.log(`[automations] Telegram sent: ${text.slice(0, 80)}...`);
}

/**
 * Send an email via GoHighLevel conversations API.
 * Sends to each contact ID in GHL_ALERT_CONTACT_IDS.
 * Zero LLM cost — direct API call, no agent involvement.
 */
async function sendGhlEmail(subject, htmlBody) {
  if (!GHL_API_KEY || GHL_ALERT_CONTACT_IDS.length === 0) {
    console.log(`[automations] GHL email not configured — logging to console only`);
    console.log(`[automations] Subject: ${subject}`);
    console.log(`[automations] Body: ${htmlBody.replace(/<[^>]+>/g, "").slice(0, 300)}...`);
    return;
  }

  for (const contactId of GHL_ALERT_CONTACT_IDS) {
    try {
      const res = await fetch("https://services.leadconnectorhq.com/conversations/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GHL_API_KEY}`,
          Version: "2021-04-15",
        },
        body: JSON.stringify({
          type: "Email",
          contactId,
          subject,
          html: htmlBody,
        }),
        signal: AbortSignal.timeout(15_000),
      });

      const data = await res.json();
      if (data.message?.id || data.messageId) {
        console.log(`[automations] GHL email sent to ${contactId}: ${subject}`);
      } else {
        console.error(`[automations] GHL email failed for ${contactId}:`, JSON.stringify(data).slice(0, 200));
      }
    } catch (err) {
      console.error(`[automations] GHL email error for ${contactId}: ${err.message}`);
    }
  }
}

async function getActiveMembers() {
  const { data, error } = await supabase
    .from("members")
    .select("*")
    .eq("status", "active");
  if (error) throw error;
  return data || [];
}

// ─── 1. Wix Payment Webhook ─────────────────────────────────────────────
// TELEGRAM: YES — new member is urgent, single message

async function handleWixPayment(body) {
  const contact = body?.contact || body?.buyerInfo || {};
  const firstName = contact?.name?.first || contact?.firstName || "";
  const lastName = contact?.name?.last || contact?.lastName || "";
  const fullName = `${firstName} ${lastName}`.trim();
  const email = contact?.email || body?.buyerInfo?.email || "";
  const phone = contact?.phone || "";
  const amount = parseFloat(body?.totals?.total || body?.priceSummary?.total?.amount || 0);

  const tags = body?.tags || [];
  const hasMatisseTag = tags.some(
    (t) => t.toLowerCase().includes("matisse") || t.toLowerCase().includes("free church")
  );
  const isTier2 = hasMatisseTag || amount < 5000;
  const now = new Date().toISOString();

  const { data: member, error: memberErr } = await supabase
    .from("members")
    .insert({
      full_name: fullName, email, phone,
      tier: isTier2 ? "tier2" : "tier1",
      matisse_tag: isTier2,
      donation_amount: amount,
      current_stage: 1, stage_status: "active",
      stage_entered_at: now, stage_updated_at: now, enrolled_at: now,
      status: "active",
      wix_card_id: body?.id || body?.orderId || "",
      usps_status: "not_shipped",
      referral_source: hasMatisseTag ? "matisse" : "direct",
    })
    .select()
    .single();

  if (memberErr) throw memberErr;

  await supabase.from("stage_history").insert({
    member_id: member.id, stage: 1, stage_name: STAGE_NAMES[1],
    entered_at: now, owner: "Cathy + Janail",
  });

  await supabase.from("agent_tasks").insert([
    { assigned_to: "janail", task_type: "intake", description: `New member ${fullName} (${isTier2 ? "Tier 2" : "Tier 1"}) — begin intake process`, member_id: member.id, status: "pending" },
    { assigned_to: "cathy", task_type: "follow_up", description: `New member ${fullName} — follow up on PMA intake form completion`, member_id: member.id, status: "pending" },
  ]);

  // Telegram: YES — urgent single event
  await sendTelegram(
    `New member: ${fullName} (${isTier2 ? "Tier 2 Matisse" : "Tier 1"}). ` +
    `Donation: $${amount}. Stage 1. Tasks assigned to Janail + Cathy.`
  );

  console.log(`[automations] New member onboarded: ${fullName} (${member.id})`);
  return member;
}

// ─── 2. USPS Tracking Monitor ───────────────────────────────────────────
// TELEGRAM: NO — batched GHL email

async function runUspsTrackingCheck() {
  const members = await getActiveMembers();
  const stage5 = members.filter((m) => m.current_stage === 5);
  if (stage5.length === 0) {
    console.log("[automations] USPS check: no Stage 5 members");
    return { checked: 0, alerts: 0 };
  }

  const now = new Date();
  const alerts = [];

  for (const m of stage5) {
    if (!m.usps_tracking_number && !m.label_created_at && !m.stage_entered_at) continue;

    const labelDate = new Date(m.label_created_at || m.stage_entered_at || m.stage_updated_at);
    const days = daysBetween(labelDate, now);

    let alertType = null;
    let severity = "info";
    let message = "";

    if (m.usps_status === "in_transit") {
      alertType = "usps_in_transit";
      message = `USPS IN TRANSIT — ${m.full_name}. Begin banking documents.`;
    } else if (m.usps_status === "delivered") {
      alertType = "usps_delivered";
      message = `USPS DELIVERED — ${m.full_name}. Documents received.`;
    } else if (days >= 30) {
      alertType = "usps_label_expired";
      severity = "critical";
      message = `Label EXPIRED for ${m.full_name} (${days} days). New label required.`;
    } else if (days >= 25) {
      alertType = "usps_label_urgent";
      severity = "urgent";
      message = `URGENT — ${m.full_name} label expires in ${30 - days} days.`;
    } else if (days >= 14) {
      alertType = "usps_label_warning";
      severity = "warning";
      message = `Label expiry warning — ${m.full_name}. Expires in ${30 - days} days.`;
    }

    if (alertType) {
      const today = new Date().toISOString().split("T")[0];
      const { data: existing } = await supabase
        .from("alert_log").select("id")
        .eq("member_id", m.id).eq("alert_type", alertType)
        .gte("created_at", today).limit(1);

      if (existing && existing.length > 0) continue;

      await supabase.from("alert_log").insert({
        member_id: m.id, alert_type: alertType, source_agent: "bridge",
        severity, title: `USPS — ${m.full_name}`, body: message,
      });

      alerts.push({ severity, message });
    }
  }

  // Send ONE batched email via GHL
  if (alerts.length > 0) {
    const rows = alerts.map(a =>
      `<tr><td style="padding:4px 8px;color:${a.severity === "critical" ? "#dc2626" : a.severity === "urgent" ? "#ea580c" : "#78716c"};font-weight:bold">${a.severity.toUpperCase()}</td><td style="padding:4px 8px">${a.message}</td></tr>`
    ).join("");

    await sendGhlEmail(
      `USPS Tracking: ${alerts.length} alert${alerts.length > 1 ? "s" : ""}`,
      `<h2 style="font-family:sans-serif">USPS Tracking Alerts</h2><table border="1" cellpadding="4" style="border-collapse:collapse;font-family:sans-serif;font-size:14px"><thead><tr><th style="padding:4px 8px">Severity</th><th style="padding:4px 8px">Alert</th></tr></thead><tbody>${rows}</tbody></table><p style="color:#78716c;font-size:12px;font-family:sans-serif">Generated ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} ET</p>`
    );
  }

  console.log(`[automations] USPS check: ${stage5.length} members, ${alerts.length} alerts`);
  return { checked: stage5.length, alerts: alerts.length };
}

// ─── 3. Stage Transition Detector ───────────────────────────────────────
// TELEGRAM: NO — batched GHL email

async function runStageThresholdCheck() {
  const members = await getActiveMembers();
  const now = new Date();
  const alerts = [];

  for (const m of members) {
    const stage = m.current_stage;
    if (stage >= 11 || !THRESHOLDS[stage]) continue;

    const enteredAt = new Date(m.stage_entered_at || m.stage_updated_at);
    const days = daysBetween(enteredAt, now);
    const threshold = THRESHOLDS[stage];

    let alertType = null;
    let severity = "warning";
    let message = "";

    if (threshold.escalation && days >= threshold.escalation) {
      alertType = "escalation";
      severity = "critical";
      message = `${m.full_name} (${m.tier}) — ${days} days in Stage ${stage} (${STAGE_NAMES[stage]}). Escalation: ${threshold.escalation} days. Owner: ${threshold.owner}.`;
    } else if (days >= threshold.alert) {
      alertType = "stall";
      message = `${m.full_name} (${m.tier}) — ${days} days in Stage ${stage} (${STAGE_NAMES[stage]}). Threshold: ${threshold.alert} days. Owner: ${threshold.owner}.`;
    }

    if (alertType) {
      const today = new Date().toISOString().split("T")[0];
      const { data: existing } = await supabase
        .from("alert_log").select("id")
        .eq("member_id", m.id).eq("alert_type", alertType).eq("stage_number", stage)
        .gte("created_at", today).limit(1);

      if (existing && existing.length > 0) continue;

      await supabase.from("alert_log").insert({
        member_id: m.id, alert_type: alertType, source_agent: "bridge", severity,
        title: `${alertType === "escalation" ? "ESCALATION" : "STALL"} — ${m.full_name} — Stage ${stage}`,
        body: message, stage_number: stage,
      });

      alerts.push({ severity, message, alertType });
    }
  }

  // Send ONE batched email via GHL
  if (alerts.length > 0) {
    const escalations = alerts.filter(a => a.alertType === "escalation");
    const stalls = alerts.filter(a => a.alertType === "stall");

    let html = `<div style="font-family:sans-serif;font-size:14px">`;
    html += `<h2>Pipeline Threshold Alerts</h2>`;

    if (escalations.length > 0) {
      html += `<h3 style="color:#dc2626">Escalations (${escalations.length})</h3><ul>`;
      for (const a of escalations) html += `<li>${a.message}</li>`;
      html += `</ul>`;
    }

    if (stalls.length > 0) {
      html += `<h3 style="color:#ea580c">Stalls (${stalls.length})</h3><ul>`;
      for (const a of stalls) html += `<li>${a.message}</li>`;
      html += `</ul>`;
    }

    html += `<p style="color:#78716c;font-size:12px">${members.length} members checked. Generated ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} ET</p></div>`;

    await sendGhlEmail(
      `Pipeline: ${alerts.length} alert${alerts.length > 1 ? "s" : ""}${escalations.length ? ` (${escalations.length} escalation${escalations.length > 1 ? "s" : ""})` : ""}`,
      html
    );
  }

  console.log(`[automations] Threshold check: ${members.length} members, ${alerts.length} alerts`);
  return { checked: members.length, alerts: alerts.length };
}

// ─── 4. Daily Pipeline Summary ──────────────────────────────────────────
// TELEGRAM: NO — GHL email

async function runDailyPipelineSummary() {
  const members = await getActiveMembers();
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    timeZone: "America/New_York",
  });

  const stageCounts = {};
  for (let i = 1; i <= 11; i++) stageCounts[i] = 0;
  members.forEach((m) => { if (m.current_stage) stageCounts[m.current_stage]++; });

  const pastThreshold = [];
  for (const m of members) {
    if (m.current_stage >= 11 || !THRESHOLDS[m.current_stage]) continue;
    const entered = new Date(m.stage_entered_at || m.stage_updated_at);
    const days = daysBetween(entered, now);
    if (days >= THRESHOLDS[m.current_stage].alert) {
      pastThreshold.push({ name: m.full_name, stage: m.current_stage, stageName: STAGE_NAMES[m.current_stage], days, tier: m.tier });
    }
  }

  const { data: completed } = await supabase
    .from("members").select("full_name, stage_updated_at")
    .eq("current_stage", 11)
    .gte("stage_updated_at", new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString());

  const active = members.filter((m) => m.current_stage < 11);

  let html = `<div style="font-family:sans-serif;font-size:14px">`;
  html += `<h2>DVTOL Pipeline Summary</h2><p>${dateStr}</p>`;
  html += `<p><strong>Active members: ${active.length}</strong></p>`;

  html += `<h3>By Stage</h3><table border="1" cellpadding="4" style="border-collapse:collapse">`;
  for (let i = 1; i <= 10; i++) {
    if (stageCounts[i] > 0) html += `<tr><td style="padding:4px 8px">Stage ${i}</td><td style="padding:4px 8px">${STAGE_NAMES[i]}</td><td style="padding:4px 8px;text-align:center"><strong>${stageCounts[i]}</strong></td></tr>`;
  }
  html += `</table>`;

  if (pastThreshold.length > 0) {
    html += `<h3 style="color:#ea580c">Past Threshold (${pastThreshold.length})</h3><ul>`;
    for (const p of pastThreshold) html += `<li>${p.name} (${p.tier}) — Stage ${p.stage} (${p.stageName}) — ${p.days} days</li>`;
    html += `</ul>`;
  }

  html += `<h3>Completed This Week (${(completed || []).length})</h3>`;
  if ((completed || []).length > 0) {
    html += `<ul>`;
    for (const c of completed || []) html += `<li>${c.full_name}</li>`;
    html += `</ul>`;
  } else {
    html += `<p style="color:#78716c">None this week</p>`;
  }
  html += `</div>`;

  await sendGhlEmail(`Daily Pipeline Summary — ${dateStr}`, html);

  console.log(`[automations] Daily summary: ${active.length} active, ${pastThreshold.length} past threshold`);
  return { active: active.length, pastThreshold: pastThreshold.length, completed: (completed || []).length };
}

// ─── 5. ShipEngine Label Creation ───────────────────────────────────────
// TELEGRAM: YES — actionable single message

async function createShippingLabel(memberId) {
  if (!SHIPENGINE_API_KEY) throw new Error("SHIPENGINE_API_KEY not set");
  if (!DVTOL_SHIP_FROM.address_line1) throw new Error("DVTOL ship-from address not configured");

  const { data: member, error } = await supabase.from("members").select("*").eq("id", memberId).single();
  if (error || !member) throw new Error(`Member not found: ${memberId}`);

  const shipTo = {
    name: member.full_name,
    address_line1: member.address_line1 || "",
    city_locality: member.city || "",
    state_province: member.state || "",
    postal_code: member.zip || "",
    country_code: "US",
  };

  if (!shipTo.address_line1) throw new Error(`No address on file for ${member.full_name}.`);

  const res = await fetch("https://api.shipengine.com/v1/labels", {
    method: "POST",
    headers: { "API-Key": SHIPENGINE_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      shipment: { ship_to: shipTo, ship_from: DVTOL_SHIP_FROM, packages: [{ weight: { value: 4, unit: "ounce" } }] },
      carrier_id: process.env.SHIPENGINE_CARRIER_ID || "se-5222700",
      service_code: "usps_first_class_mail", label_format: "pdf", label_download_type: "url",
    }),
    signal: AbortSignal.timeout(30_000),
  });

  const data = await res.json();
  if (data.errors?.length > 0) throw new Error(`ShipEngine: ${data.errors.map(e => e.message).join(", ")}`);

  const labelUrl = data.label_download?.pdf || data.label_download?.href || "";
  const trackingNumber = data.tracking_number || "";

  await supabase.from("members").update({ usps_tracking_number: trackingNumber, usps_status: "not_shipped", label_created_at: new Date().toISOString() }).eq("id", memberId);
  await supabase.from("usps_tracking").insert({ member_id: memberId, tracking_number: trackingNumber, label_provider: "shipengine", status: "label_created", label_created_at: new Date().toISOString(), last_checked_at: new Date().toISOString() });

  // Telegram: YES — actionable single message
  await sendTelegram(
    `USPS label created for ${member.full_name} (${member.tier}).\n` +
    `Tracking: ${trackingNumber}\nLabel: ${labelUrl}\n` +
    `Janail — attach this label to the Agreement + SOF email.`
  );

  console.log(`[automations] Label created for ${member.full_name}: ${trackingNumber}`);
  return { member_id: memberId, tracking_number: trackingNumber, label_url: labelUrl };
}

// ─── Express Routes ─────────────────────────────────────────────────────

export function registerAutomations(app, requireBearerAuth) {
  if (!supabase) {
    console.log("[automations] Supabase not configured — automations disabled");
    return;
  }

  console.log("[automations] Registering DVTOL automation endpoints...");

  app.post("/webhook/wix-payment", async (req, res) => {
    try {
      const member = await handleWixPayment(req.body);
      res.json({ ok: true, member_id: member.id, full_name: member.full_name });
    } catch (err) {
      console.error("[webhook] Wix payment error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/automation/usps-check", requireBearerAuth, async (_req, res) => {
    try { res.json({ ok: true, ...await runUspsTrackingCheck() }); } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/automation/threshold-check", requireBearerAuth, async (_req, res) => {
    try { res.json({ ok: true, ...await runStageThresholdCheck() }); } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/automation/daily-summary", requireBearerAuth, async (_req, res) => {
    try { res.json({ ok: true, ...await runDailyPipelineSummary() }); } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/automation/create-label", requireBearerAuth, async (req, res) => {
    const { member_id } = req.body;
    if (!member_id) return res.status(400).json({ error: "member_id is required" });
    try { res.json({ ok: true, ...await createShippingLabel(member_id) }); } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/automation/status", (_req, res) => {
    res.json({
      enabled: true,
      supabase: !!supabase,
      shipEngine: SHIPENGINE_API_KEY ? "configured" : "not_set",
      telegram: TELEGRAM_BOT_TOKEN ? "configured" : "not_set",
      ghlEmail: GHL_API_KEY && GHL_ALERT_CONTACT_IDS.length > 0 ? `configured (${GHL_ALERT_CONTACT_IDS.length} recipients)` : "not_set",
      notifications: {
        telegram: "Wix payments + ShipEngine labels ONLY",
        ghlEmail: "Threshold alerts + USPS tracking + daily summary",
      },
      schedules: { uspsCheck: "every 4 hours", thresholdCheck: "every 30 minutes", dailySummary: "7:00 AM EST daily" },
    });
  });

  // ─── Scheduled Jobs ─────────────────────────────────────────────────

  setInterval(async () => {
    try { await runStageThresholdCheck(); } catch (err) { console.error("[automations] Threshold check failed:", err.message); }
  }, 30 * 60 * 1000);

  setInterval(async () => {
    try { await runUspsTrackingCheck(); } catch (err) { console.error("[automations] USPS check failed:", err.message); }
  }, 4 * 60 * 60 * 1000);

  let lastSummaryDate = "";
  setInterval(async () => {
    const now = new Date();
    const est = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const today = est.toISOString().split("T")[0];
    if (est.getHours() === 7 && est.getMinutes() === 0 && lastSummaryDate !== today) {
      lastSummaryDate = today;
      try { await runDailyPipelineSummary(); } catch (err) { console.error("[automations] Daily summary failed:", err.message); }
    }
  }, 60 * 1000);

  setTimeout(async () => {
    try {
      console.log("[automations] Running initial threshold check...");
      await runStageThresholdCheck();
    } catch (err) { console.error("[automations] Initial check failed:", err.message); }
  }, 30_000);

  console.log("[automations] All schedules registered");
  console.log("[automations]   - Stage thresholds: every 30 min → GHL email");
  console.log("[automations]   - USPS tracking: every 4 hours → GHL email");
  console.log("[automations]   - Daily summary: 7:00 AM EST → GHL email");
  console.log("[automations]   - Wix webhook: POST /webhook/wix-payment → Telegram");
}
