// =============================================================================
// Agent Action Logger — writes every LLM interaction to Supabase agent_actions
// CommonJS (.cjs) so custom agent server.js files can require() it
// =============================================================================

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let supabase = null;

function getClient() {
  if (!supabase && SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    });
  }
  return supabase;
}

// Claude Sonnet 4 pricing (per token)
const PRICING = {
  "claude-sonnet-4-20250514": { input: 3 / 1_000_000, output: 15 / 1_000_000 },
  // fallback for unknown models
  default: { input: 3 / 1_000_000, output: 15 / 1_000_000 },
};

function estimateCost(model, tokensIn, tokensOut) {
  const rates = PRICING[model] || PRICING.default;
  return tokensIn * rates.input + tokensOut * rates.output;
}

/**
 * Log an agent action to Supabase agent_actions table.
 */
async function logAgentAction({
  agent_role,
  action_type,
  description,
  member_id = null,
  input_data = {},
  output_data = {},
  approval_status = "none",
  error_message = null,
}) {
  const client = getClient();
  if (!client) {
    console.warn("[action-logger] Supabase not configured — skipping log");
    return null;
  }

  try {
    const { data, error } = await client.from("agent_actions").insert({
      agent_role,
      action_type,
      description,
      member_id,
      input_data,
      output_data,
      approval_status,
      error_message,
    }).select("id").single();

    if (error) {
      console.error("[action-logger] Insert failed:", error.message);
      return null;
    }

    return data;
  } catch (err) {
    console.error("[action-logger] Error:", err.message);
    return null;
  }
}

/**
 * Extract token usage from an OpenClaw gateway response and log the action.
 * Call this after every /task proxy response.
 */
async function extractUsageAndLog(agentRole, taskText, gatewayResponse, extra = {}) {
  const usage = gatewayResponse?.usage || {};
  const tokensIn = usage.input_tokens || 0;
  const tokensOut = usage.output_tokens || 0;
  const model = gatewayResponse?.model || "claude-sonnet-4-20250514";

  const costUsd = estimateCost(model, tokensIn, tokensOut);

  const desc = taskText.length > 200 ? taskText.slice(0, 197) + "..." : taskText;

  return logAgentAction({
    agent_role: agentRole,
    action_type: extra.action_type || "query",
    description: desc,
    member_id: extra.member_id || null,
    input_data: {
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      model,
      estimated_cost_usd: costUsd,
    },
    output_data: {},
    approval_status: extra.approval_status || "none",
    error_message: extra.error_message || null,
  });
}

module.exports = { logAgentAction, extractUsageAndLog };
