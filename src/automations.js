// =============================================================================
// DVTOL Automations — Pipeline monitoring, USPS tracking, daily summary
// Runs inside BRIDGE (or any agent with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
// =============================================================================

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VANCE_URL = process.env.VANCE_ENDPOINT || process.env.NOVA_ENDPOINT ?
  (process.env.VANCE_ENDPOINT || "https://dvtol-system-production.up.railway.app") : "";
const VANCE_TOKEN = process.env.SETUP_PASSWORD || "";

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

async function notifyVance(message) {
  if (!VANCE_URL) {
    console.log("[automations] VANCE_URL not set, skipping notification");
    return;
  }
  try {
    const res = await fetch(`${VANCE_URL}/task`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${VANCE_TOKEN}`,
      },
      body: JSON.stringify({ task: message }),
      signal: AbortSignal.timeout(120_000),
    });
    const data = await res.json();
    console.log(`[automations] VANCE notified: ${message.slice(0, 80)}...`);
    return data;
  } catch (err) {
    console.error(`[automations] VANCE notification failed: ${err.message}`);
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

  // Insert member
  const { data: member, error: memberErr } = await supabase
    .from("members")
    .insert({
      full_name: fullName,
      email,
      phone,
      tier: isTier2 ? "tier2" : "tier1",
      matisse_tag: isTier2,
      donation_amount: amount,
      current_stage: 1,
      stage_status: "active",
      stage_entered_at: now,
      stage_updated_at: now,
      enrolled_at: now,
      status: "active",
      wix_card_id: body?.id || body?.orderId || "",
      usps_status: "not_shipped",
      referral_source: hasMatisseTag ? "matisse" : "direct",
    })
    .select()
    .single();

  if (memberErr) throw memberErr;

  // Log stage 1 entry
  await supabase.from("stage_history").insert({
    member_id: member.id,
    stage: 1,
    stage_name: STAGE_NAMES[1],
    entered_at: now,
    owner: "Cathy + Janail",
  });

  // Create tasks for Janail and Cathy
  await supabase.from("agent_tasks").insert([
    {
      assigned_to: "janail",
      task_type: "intake",
      description: `New member ${fullName} (${isTier2 ? "Tier 2" : "Tier 1"}) — begin intake process`,
      member_id: member.id,
      status: "pending",
    },
    {
      assigned_to: "cathy",
      task_type: "follow_up",
      description: `New member ${fullName} — follow up on PMA intake form completion`,
      member_id: member.id,
      status: "pending",
    },
  ]);

  // Notify VANCE
  await notifyVance(
    `New member joined: ${fullName} (${isTier2 ? "Tier 2 Matisse" : "Tier 1"}). ` +
    `Donation: $${amount}. Stage 1 — Full Donation Made. ` +
    `Notify Rodney and Shakira. Tasks assigned to Janail (intake) and Cathy (follow-up).`
  );

  console.log(`[automations] New member onboarded: ${fullName} (${member.id})`);
  return member;
}

// ─── 2. USPS Tracking Monitor ───────────────────────────────────────────

async function runUspsTrackingCheck() {
  const members = await getActiveMembers();
  const stage5 = members.filter((m) => m.current_stage === 5);
  if (stage5.length === 0) {
    console.log("[automations] USPS check: no Stage 5 members");
    return { checked: 0, alerts: 0 };
  }

  const now = new Date();
  let alertCount = 0;

  for (const m of stage5) {
    if (!m.usps_tracking_number && !m.label_created_at && !m.stage_entered_at) continue;

    const labelDate = new Date(m.label_created_at || m.stage_entered_at || m.stage_updated_at);
    const days = daysBetween(labelDate, now);

    let alertType = null;
    let severity = "info";
    let message = "";

    if (m.usps_status === "in_transit") {
      alertType = "usps_in_transit";
      message = `USPS IN TRANSIT — ${m.full_name}. Begin banking documents. Alert customersupport@drvstreeoflife.org.`;
    } else if (m.usps_status === "delivered") {
      alertType = "usps_delivered";
      message = `USPS DELIVERED — ${m.full_name}. Documents received.`;
    } else if (days >= 30) {
      alertType = "usps_label_expired";
      severity = "critical";
      message = `Label EXPIRED for ${m.full_name} (${days} days). New Pirate Ship label required immediately.`;
    } else if (days >= 25) {
      alertType = "usps_label_urgent";
      severity = "urgent";
      message = `URGENT — ${m.full_name} mailing label expires in ${30 - days} days. Immediate contact required.`;
    } else if (days >= 14) {
      alertType = "usps_label_warning";
      severity = "warning";
      message = `Label expiry warning — ${m.full_name}. Label expires in ${30 - days} days if not used.`;
    }

    if (alertType) {
      // Check if this alert already fired today
      const today = new Date().toISOString().split("T")[0];
      const { data: existing } = await supabase
        .from("alert_log")
        .select("id")
        .eq("member_id", m.id)
        .eq("alert_type", alertType)
        .gte("created_at", today)
        .limit(1);

      if (existing && existing.length > 0) continue; // Already alerted today

      await supabase.from("alert_log").insert({
        member_id: m.id,
        alert_type: alertType,
        source_agent: "bridge",
        severity,
        title: `USPS — ${m.full_name}`,
        body: message,
      });

      await notifyVance(message);
      alertCount++;
    }
  }

  console.log(`[automations] USPS check: ${stage5.length} members, ${alertCount} alerts`);
  return { checked: stage5.length, alerts: alertCount };
}

// ─── 3. Stage Transition Detector ───────────────────────────────────────

async function runStageThresholdCheck() {
  const members = await getActiveMembers();
  const now = new Date();
  let alertCount = 0;

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
      message =
        `ESCALATION — ${m.full_name} (${m.tier}) — ${days} days in Stage ${stage} (${STAGE_NAMES[stage]}). ` +
        `Escalation threshold: ${threshold.escalation} days. Owner: ${threshold.owner}. Immediate action required.`;
    } else if (days >= threshold.alert) {
      alertType = "stall";
      message =
        `PIPELINE ALERT — ${m.full_name} (${m.tier}) — ${days} days in Stage ${stage} (${STAGE_NAMES[stage]}). ` +
        `Threshold: ${threshold.alert} days. Recommended action owner: ${threshold.owner}.`;
    }

    if (alertType) {
      // Check if this exact alert already fired today
      const today = new Date().toISOString().split("T")[0];
      const { data: existing } = await supabase
        .from("alert_log")
        .select("id")
        .eq("member_id", m.id)
        .eq("alert_type", alertType)
        .eq("stage_number", stage)
        .gte("created_at", today)
        .limit(1);

      if (existing && existing.length > 0) continue;

      await supabase.from("alert_log").insert({
        member_id: m.id,
        alert_type: alertType,
        source_agent: "bridge",
        severity,
        title: `${alertType === "escalation" ? "ESCALATION" : "STALL"} — ${m.full_name} — Stage ${stage}`,
        body: message,
        stage_number: stage,
      });

      await notifyVance(message);
      alertCount++;
    }
  }

  console.log(`[automations] Threshold check: ${members.length} members, ${alertCount} alerts`);
  return { checked: members.length, alerts: alertCount };
}

// ─── 4. Daily Pipeline Summary ──────────────────────────────────────────

async function runDailyPipelineSummary() {
  const members = await getActiveMembers();
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  // Count by stage
  const stageCounts = {};
  for (let i = 1; i <= 11; i++) stageCounts[i] = 0;
  members.forEach((m) => { if (m.current_stage) stageCounts[m.current_stage]++; });

  // Find members past threshold
  const pastThreshold = [];
  for (const m of members) {
    if (m.current_stage >= 11 || !THRESHOLDS[m.current_stage]) continue;
    const entered = new Date(m.stage_entered_at || m.stage_updated_at);
    const days = daysBetween(entered, now);
    if (days >= THRESHOLDS[m.current_stage].alert) {
      pastThreshold.push({
        name: m.full_name, stage: m.current_stage,
        stageName: STAGE_NAMES[m.current_stage], days, tier: m.tier,
      });
    }
  }

  // Recently completed (last 7 days)
  const { data: completed } = await supabase
    .from("members")
    .select("full_name, stage_updated_at")
    .eq("current_stage", 11)
    .gte("stage_updated_at", new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString());

  // Build summary
  const active = members.filter((m) => m.current_stage < 11);
  let summary = `DVTOL Pipeline Summary — ${dateStr}\n`;
  summary += "━".repeat(40) + "\n";
  summary += `Active members: ${active.length}\n\n`;

  summary += "By stage:\n";
  for (let i = 1; i <= 10; i++) {
    if (stageCounts[i] > 0) summary += `  Stage ${i} (${STAGE_NAMES[i]}): ${stageCounts[i]}\n`;
  }

  summary += `\nMembers past threshold: ${pastThreshold.length}\n`;
  for (const p of pastThreshold) {
    summary += `  ⚠ ${p.name} — Stage ${p.stage} (${p.stageName}) — ${p.days} days\n`;
  }

  summary += `\nCompleted this week: ${(completed || []).length}\n`;
  for (const c of completed || []) {
    summary += `  ✓ ${c.full_name}\n`;
  }
  summary += "━".repeat(40);

  // Send to VANCE for delivery to Rodney + Shakira
  await notifyVance(
    `Deliver this daily pipeline summary to both Rodney and Shakira on Telegram immediately:\n\n${summary}`
  );

  console.log(`[automations] Daily summary: ${active.length} active, ${pastThreshold.length} past threshold`);
  return { active: active.length, pastThreshold: pastThreshold.length, completed: (completed || []).length };
}

// ─── Express Routes ─────────────────────────────────────────────────────

export function registerAutomations(app, requireBearerAuth) {
  if (!supabase) {
    console.log("[automations] Supabase not configured — automations disabled");
    return;
  }

  console.log("[automations] Registering DVTOL automation endpoints...");

  // Webhook: Wix payment → new member
  app.post("/webhook/wix-payment", async (req, res) => {
    try {
      const member = await handleWixPayment(req.body);
      res.json({ ok: true, member_id: member.id, full_name: member.full_name });
    } catch (err) {
      console.error("[webhook] Wix payment error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Manual trigger endpoints (protected)
  app.post("/api/automation/usps-check", requireBearerAuth, async (_req, res) => {
    try {
      const result = await runUspsTrackingCheck();
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/automation/threshold-check", requireBearerAuth, async (_req, res) => {
    try {
      const result = await runStageThresholdCheck();
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/automation/daily-summary", requireBearerAuth, async (_req, res) => {
    try {
      const result = await runDailyPipelineSummary();
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Status endpoint
  app.get("/api/automation/status", (_req, res) => {
    res.json({
      enabled: true,
      supabase: !!supabase,
      vanceUrl: VANCE_URL ? "configured" : "not_set",
      schedules: {
        uspsCheck: "every 4 hours",
        thresholdCheck: "every 30 minutes",
        dailySummary: "7:00 AM EST daily",
      },
    });
  });

  // ─── Scheduled Jobs ─────────────────────────────────────────────────

  // Stage threshold check — every 30 minutes
  setInterval(async () => {
    try {
      await runStageThresholdCheck();
    } catch (err) {
      console.error("[automations] Threshold check failed:", err.message);
    }
  }, 30 * 60 * 1000);

  // USPS tracking check — every 4 hours
  setInterval(async () => {
    try {
      await runUspsTrackingCheck();
    } catch (err) {
      console.error("[automations] USPS check failed:", err.message);
    }
  }, 4 * 60 * 60 * 1000);

  // Daily pipeline summary — check every minute, fire at 7:00 AM EST
  let lastSummaryDate = "";
  setInterval(async () => {
    const now = new Date();
    const est = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const hour = est.getHours();
    const minute = est.getMinutes();
    const today = est.toISOString().split("T")[0];

    if (hour === 7 && minute === 0 && lastSummaryDate !== today) {
      lastSummaryDate = today;
      try {
        await runDailyPipelineSummary();
      } catch (err) {
        console.error("[automations] Daily summary failed:", err.message);
      }
    }
  }, 60 * 1000);

  // Run initial threshold check 30 seconds after startup
  setTimeout(async () => {
    try {
      console.log("[automations] Running initial threshold check...");
      await runStageThresholdCheck();
    } catch (err) {
      console.error("[automations] Initial check failed:", err.message);
    }
  }, 30_000);

  console.log("[automations] ✓ All schedules registered");
  console.log("[automations]   - Stage thresholds: every 30 min");
  console.log("[automations]   - USPS tracking: every 4 hours");
  console.log("[automations]   - Daily summary: 7:00 AM EST");
  console.log("[automations]   - Wix webhook: POST /webhook/wix-payment");
}
