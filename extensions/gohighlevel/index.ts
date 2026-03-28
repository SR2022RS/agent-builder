import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { execFileSync } from "node:child_process";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

interface GhlConfig {
  enabled: boolean;
  apiKey: string;
  locationId: string;
}

function resolveConfig(pluginConfig: Record<string, unknown>): GhlConfig {
  return {
    enabled: (pluginConfig.enabled as boolean) ?? true,
    apiKey:
      (pluginConfig.apiKey as string) ||
      process.env.GHL_API_KEY ||
      process.env.GHL_ACCOUNT_TOKEN ||
      process.env.GHL_PRIVATE_TOKEN ||
      "",
    locationId:
      (pluginConfig.locationId as string) ||
      process.env.GHL_LOCATION_ID ||
      "",
  };
}

function ghlFetch(
  method: string,
  path: string,
  apiKey: string,
  body?: Record<string, unknown>,
): string {
  const url = `${GHL_BASE}${path}`;
  const args = [
    url, "-s", "-X", method,
    "-H", `Authorization: Bearer ${apiKey}`,
    "-H", `Version: ${GHL_VERSION}`,
    "-H", "Content-Type: application/json",
    "-H", "Accept: application/json",
  ];
  if (body) {
    args.push("-d", JSON.stringify(body));
  }
  return execFileSync("curl", args, { encoding: "utf-8", timeout: 30_000 });
}

function ok(text: string) {
  return { content: [{ type: "text" as const, text }], details: null };
}

function err(msg: string) {
  return { content: [{ type: "text" as const, text: `Error: ${msg}` }], details: null };
}

// ─── Tool Definitions ────────────────────────────────────────────────

interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (params: Record<string, unknown>, cfg: GhlConfig) => { content: Array<{ type: "text"; text: string }>; details: null };
}

const tools: ToolDef[] = [
  // ── CONTACTS ──────────────────────────────────────────────────────
  {
    name: "ghl_search_contacts",
    description: "Search contacts in GoHighLevel by name, email, phone, or any query string. Returns matching contacts with their details.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search term (name, email, phone, etc.)" },
        limit: { type: "number", description: "Max results (default 20)" },
      },
      required: ["query"],
    },
    execute: (p, cfg) => {
      const limit = (p.limit as number) || 20;
      const q = encodeURIComponent(p.query as string);
      return ok(ghlFetch("GET", `/contacts/?locationId=${cfg.locationId}&query=${q}&limit=${limit}`, cfg.apiKey));
    },
  },
  {
    name: "ghl_get_contact",
    description: "Get a contact's full details by their contact ID.",
    parameters: {
      type: "object",
      properties: {
        contactId: { type: "string", description: "The contact ID" },
      },
      required: ["contactId"],
    },
    execute: (p, cfg) => ok(ghlFetch("GET", `/contacts/${p.contactId}`, cfg.apiKey)),
  },
  {
    name: "ghl_create_contact",
    description: "Create a new contact in GoHighLevel. Requires at least a name or email/phone.",
    parameters: {
      type: "object",
      properties: {
        firstName: { type: "string", description: "First name" },
        lastName: { type: "string", description: "Last name" },
        email: { type: "string", description: "Email address" },
        phone: { type: "string", description: "Phone number" },
        tags: { type: "array", items: { type: "string" }, description: "Tags to apply" },
        source: { type: "string", description: "Lead source" },
        companyName: { type: "string", description: "Company name" },
      },
    },
    execute: (p, cfg) => {
      const body: Record<string, unknown> = { locationId: cfg.locationId };
      for (const k of ["firstName", "lastName", "email", "phone", "tags", "source", "companyName"]) {
        if (p[k] !== undefined) body[k] = p[k];
      }
      return ok(ghlFetch("POST", "/contacts/", cfg.apiKey, body));
    },
  },
  {
    name: "ghl_update_contact",
    description: "Update an existing contact's information (name, email, phone, tags, custom fields, etc.).",
    parameters: {
      type: "object",
      properties: {
        contactId: { type: "string", description: "The contact ID to update" },
        firstName: { type: "string" },
        lastName: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        companyName: { type: "string" },
      },
      required: ["contactId"],
    },
    execute: (p, cfg) => {
      const { contactId, ...fields } = p;
      return ok(ghlFetch("PUT", `/contacts/${contactId}`, cfg.apiKey, fields as Record<string, unknown>));
    },
  },
  {
    name: "ghl_add_contact_tags",
    description: "Add one or more tags to a contact. Tags can trigger GHL automations/workflows.",
    parameters: {
      type: "object",
      properties: {
        contactId: { type: "string", description: "The contact ID" },
        tags: { type: "array", items: { type: "string" }, description: "Tags to add" },
      },
      required: ["contactId", "tags"],
    },
    execute: (p, cfg) => ok(ghlFetch("POST", `/contacts/${p.contactId}/tags`, cfg.apiKey, { tags: p.tags })),
  },
  {
    name: "ghl_remove_contact_tags",
    description: "Remove one or more tags from a contact.",
    parameters: {
      type: "object",
      properties: {
        contactId: { type: "string", description: "The contact ID" },
        tags: { type: "array", items: { type: "string" }, description: "Tags to remove" },
      },
      required: ["contactId", "tags"],
    },
    execute: (p, cfg) => ok(ghlFetch("DELETE", `/contacts/${p.contactId}/tags`, cfg.apiKey, { tags: p.tags })),
  },
  {
    name: "ghl_delete_contact",
    description: "Delete a contact from GoHighLevel permanently.",
    parameters: {
      type: "object",
      properties: {
        contactId: { type: "string", description: "The contact ID to delete" },
      },
      required: ["contactId"],
    },
    execute: (p, cfg) => ok(ghlFetch("DELETE", `/contacts/${p.contactId}`, cfg.apiKey)),
  },

  // ── CONVERSATIONS & MESSAGING ─────────────────────────────────────
  {
    name: "ghl_search_conversations",
    description: "Search conversations in GoHighLevel. Can filter by contact, assignee, or search query.",
    parameters: {
      type: "object",
      properties: {
        contactId: { type: "string", description: "Filter by contact ID" },
        q: { type: "string", description: "Search query" },
        assignedTo: { type: "string", description: "Filter by assigned user ID" },
        limit: { type: "number", description: "Max results (default 20)" },
      },
    },
    execute: (p, cfg) => {
      const params = new URLSearchParams({ locationId: cfg.locationId });
      if (p.contactId) params.set("contactId", p.contactId as string);
      if (p.q) params.set("q", p.q as string);
      if (p.assignedTo) params.set("assignedTo", p.assignedTo as string);
      params.set("limit", String((p.limit as number) || 20));
      return ok(ghlFetch("GET", `/conversations/search?${params}`, cfg.apiKey));
    },
  },
  {
    name: "ghl_get_conversation",
    description: "Get a conversation by ID, including metadata and status.",
    parameters: {
      type: "object",
      properties: {
        conversationId: { type: "string", description: "The conversation ID" },
      },
      required: ["conversationId"],
    },
    execute: (p, cfg) => ok(ghlFetch("GET", `/conversations/${p.conversationId}`, cfg.apiKey)),
  },
  {
    name: "ghl_get_messages",
    description: "Get messages from a conversation thread.",
    parameters: {
      type: "object",
      properties: {
        conversationId: { type: "string", description: "The conversation ID" },
        limit: { type: "number", description: "Max messages to return" },
      },
      required: ["conversationId"],
    },
    execute: (p, cfg) => {
      const limit = (p.limit as number) || 20;
      return ok(ghlFetch("GET", `/conversations/${p.conversationId}/messages?limit=${limit}`, cfg.apiKey));
    },
  },
  {
    name: "ghl_send_message",
    description: "Send a message (SMS, Email, WhatsApp, etc.) to a contact through GoHighLevel. For Email, provide subject and html/body. For SMS/WhatsApp, provide message.",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["SMS", "Email", "WhatsApp", "GMB", "IG", "FB", "Live_Chat"], description: "Message type" },
        contactId: { type: "string", description: "The contact ID to message" },
        message: { type: "string", description: "Message body (for SMS, WhatsApp, chat types)" },
        subject: { type: "string", description: "Email subject (for Email type)" },
        html: { type: "string", description: "Email HTML body (for Email type)" },
        conversationId: { type: "string", description: "Existing conversation ID (optional)" },
      },
      required: ["type", "contactId"],
    },
    execute: (p, cfg) => {
      const body: Record<string, unknown> = {
        type: p.type,
        contactId: p.contactId,
      };
      if (p.message) body.message = p.message;
      if (p.subject) body.subject = p.subject;
      if (p.html) body.html = p.html;
      if (p.conversationId) body.conversationId = p.conversationId;
      return ok(ghlFetch("POST", "/conversations/messages", cfg.apiKey, body));
    },
  },

  // ── CALENDARS & APPOINTMENTS ──────────────────────────────────────
  {
    name: "ghl_list_calendars",
    description: "List all calendars configured in the GoHighLevel location.",
    parameters: { type: "object", properties: {} },
    execute: (_p, cfg) => ok(ghlFetch("GET", `/calendars/?locationId=${cfg.locationId}`, cfg.apiKey)),
  },
  {
    name: "ghl_get_free_slots",
    description: "Get available time slots for a calendar. Use this before booking to check availability.",
    parameters: {
      type: "object",
      properties: {
        calendarId: { type: "string", description: "Calendar ID" },
        startDate: { type: "string", description: "Start date (YYYY-MM-DD)" },
        endDate: { type: "string", description: "End date (YYYY-MM-DD)" },
        timezone: { type: "string", description: "Timezone (e.g. America/New_York)" },
      },
      required: ["calendarId", "startDate", "endDate"],
    },
    execute: (p, cfg) => {
      const params = new URLSearchParams({
        startDate: p.startDate as string,
        endDate: p.endDate as string,
      });
      if (p.timezone) params.set("timezone", p.timezone as string);
      return ok(ghlFetch("GET", `/calendars/${p.calendarId}/free-slots?${params}`, cfg.apiKey));
    },
  },
  {
    name: "ghl_create_appointment",
    description: "Book an appointment on a GHL calendar for a contact.",
    parameters: {
      type: "object",
      properties: {
        calendarId: { type: "string", description: "Calendar ID" },
        contactId: { type: "string", description: "Contact ID" },
        startTime: { type: "string", description: "Start time (ISO 8601)" },
        endTime: { type: "string", description: "End time (ISO 8601)" },
        title: { type: "string", description: "Appointment title" },
        status: { type: "string", enum: ["confirmed", "new", "showed", "noshow", "cancelled"], description: "Appointment status" },
        notes: { type: "string", description: "Appointment notes" },
        assignedUserId: { type: "string", description: "Assigned team member user ID" },
      },
      required: ["calendarId", "contactId", "startTime", "endTime"],
    },
    execute: (p, cfg) => {
      const body: Record<string, unknown> = {
        calendarId: p.calendarId,
        locationId: cfg.locationId,
        contactId: p.contactId,
        startTime: p.startTime,
        endTime: p.endTime,
        appointmentStatus: (p.status as string) || "new",
      };
      if (p.title) body.title = p.title;
      if (p.notes) body.notes = p.notes;
      if (p.assignedUserId) body.assignedUserId = p.assignedUserId;
      return ok(ghlFetch("POST", "/calendars/events/appointments", cfg.apiKey, body));
    },
  },
  {
    name: "ghl_list_events",
    description: "List calendar events (appointments) within a date range.",
    parameters: {
      type: "object",
      properties: {
        calendarId: { type: "string", description: "Calendar ID (optional, all calendars if omitted)" },
        startTime: { type: "string", description: "Start time filter (ISO 8601)" },
        endTime: { type: "string", description: "End time filter (ISO 8601)" },
      },
    },
    execute: (p, cfg) => {
      const params = new URLSearchParams({ locationId: cfg.locationId });
      if (p.calendarId) params.set("calendarId", p.calendarId as string);
      if (p.startTime) params.set("startTime", p.startTime as string);
      if (p.endTime) params.set("endTime", p.endTime as string);
      return ok(ghlFetch("GET", `/calendars/events?${params}`, cfg.apiKey));
    },
  },
  {
    name: "ghl_get_appointment",
    description: "Get details of a specific appointment by its event ID.",
    parameters: {
      type: "object",
      properties: {
        eventId: { type: "string", description: "The appointment/event ID" },
      },
      required: ["eventId"],
    },
    execute: (p, cfg) => ok(ghlFetch("GET", `/calendars/events/appointments/${p.eventId}`, cfg.apiKey)),
  },
  {
    name: "ghl_update_appointment",
    description: "Update an existing appointment (reschedule, change status, add notes).",
    parameters: {
      type: "object",
      properties: {
        eventId: { type: "string", description: "The appointment/event ID" },
        startTime: { type: "string", description: "New start time (ISO 8601)" },
        endTime: { type: "string", description: "New end time (ISO 8601)" },
        title: { type: "string" },
        status: { type: "string", enum: ["confirmed", "new", "showed", "noshow", "cancelled"] },
        notes: { type: "string" },
      },
      required: ["eventId"],
    },
    execute: (p, cfg) => {
      const { eventId, status, ...fields } = p;
      const body = { ...fields } as Record<string, unknown>;
      if (status) body.appointmentStatus = status;
      return ok(ghlFetch("PUT", `/calendars/events/appointments/${eventId}`, cfg.apiKey, body));
    },
  },

  // ── OPPORTUNITIES & PIPELINES ─────────────────────────────────────
  {
    name: "ghl_list_pipelines",
    description: "List all pipelines in the GoHighLevel location. Includes stages within each pipeline.",
    parameters: { type: "object", properties: {} },
    execute: (_p, cfg) => ok(ghlFetch("GET", `/opportunities/pipelines?locationId=${cfg.locationId}`, cfg.apiKey)),
  },
  {
    name: "ghl_search_opportunities",
    description: "Search opportunities (deals) in a pipeline. Can filter by status, stage, contact, or search query.",
    parameters: {
      type: "object",
      properties: {
        pipelineId: { type: "string", description: "Pipeline ID to search in" },
        stageId: { type: "string", description: "Filter by stage ID" },
        status: { type: "string", enum: ["open", "won", "lost", "abandoned", "all"], description: "Filter by status" },
        contactId: { type: "string", description: "Filter by contact" },
        q: { type: "string", description: "Search query" },
        limit: { type: "number", description: "Max results" },
      },
    },
    execute: (p, cfg) => {
      const params = new URLSearchParams({ locationId: cfg.locationId });
      for (const k of ["pipelineId", "stageId", "status", "contactId", "q"]) {
        if (p[k]) params.set(k, p[k] as string);
      }
      params.set("limit", String((p.limit as number) || 20));
      return ok(ghlFetch("GET", `/opportunities/search?${params}`, cfg.apiKey));
    },
  },
  {
    name: "ghl_create_opportunity",
    description: "Create a new opportunity (deal) in a pipeline for a contact.",
    parameters: {
      type: "object",
      properties: {
        pipelineId: { type: "string", description: "Pipeline ID" },
        stageId: { type: "string", description: "Stage ID to place the deal in" },
        contactId: { type: "string", description: "Contact ID" },
        name: { type: "string", description: "Deal name" },
        status: { type: "string", enum: ["open", "won", "lost", "abandoned"] },
        monetaryValue: { type: "number", description: "Deal value in dollars" },
        source: { type: "string", description: "Lead source" },
        assignedTo: { type: "string", description: "Assigned user ID" },
      },
      required: ["pipelineId", "stageId", "contactId", "name"],
    },
    execute: (p, cfg) => {
      const body: Record<string, unknown> = {
        locationId: cfg.locationId,
        pipelineId: p.pipelineId,
        stageId: p.stageId,
        contactId: p.contactId,
        name: p.name,
        status: (p.status as string) || "open",
      };
      if (p.monetaryValue !== undefined) body.monetaryValue = p.monetaryValue;
      if (p.source) body.source = p.source;
      if (p.assignedTo) body.assignedTo = p.assignedTo;
      return ok(ghlFetch("POST", "/opportunities/", cfg.apiKey, body));
    },
  },
  {
    name: "ghl_update_opportunity",
    description: "Update an opportunity — change stage, status, value, etc.",
    parameters: {
      type: "object",
      properties: {
        opportunityId: { type: "string", description: "Opportunity ID" },
        stageId: { type: "string", description: "Move to this stage" },
        status: { type: "string", enum: ["open", "won", "lost", "abandoned"] },
        monetaryValue: { type: "number" },
        name: { type: "string" },
        assignedTo: { type: "string" },
      },
      required: ["opportunityId"],
    },
    execute: (p, cfg) => {
      const { opportunityId, ...fields } = p;
      return ok(ghlFetch("PUT", `/opportunities/${opportunityId}`, cfg.apiKey, fields as Record<string, unknown>));
    },
  },
  {
    name: "ghl_get_opportunity",
    description: "Get full details of a specific opportunity by ID.",
    parameters: {
      type: "object",
      properties: {
        opportunityId: { type: "string", description: "Opportunity ID" },
      },
      required: ["opportunityId"],
    },
    execute: (p, cfg) => ok(ghlFetch("GET", `/opportunities/${p.opportunityId}`, cfg.apiKey)),
  },

  // ── TASKS ─────────────────────────────────────────────────────────
  {
    name: "ghl_list_tasks",
    description: "List tasks for a specific contact.",
    parameters: {
      type: "object",
      properties: {
        contactId: { type: "string", description: "Contact ID" },
      },
      required: ["contactId"],
    },
    execute: (p, cfg) => ok(ghlFetch("GET", `/contacts/${p.contactId}/tasks`, cfg.apiKey)),
  },
  {
    name: "ghl_create_task",
    description: "Create a task for a contact (follow-up, action item, etc.).",
    parameters: {
      type: "object",
      properties: {
        contactId: { type: "string", description: "Contact ID" },
        title: { type: "string", description: "Task title" },
        body: { type: "string", description: "Task description" },
        dueDate: { type: "string", description: "Due date (ISO 8601)" },
        assignedTo: { type: "string", description: "Assigned user ID" },
      },
      required: ["contactId", "title"],
    },
    execute: (p, cfg) => {
      const body: Record<string, unknown> = { title: p.title };
      if (p.body) body.body = p.body;
      if (p.dueDate) body.dueDate = p.dueDate;
      if (p.assignedTo) body.assignedTo = p.assignedTo;
      return ok(ghlFetch("POST", `/contacts/${p.contactId}/tasks`, cfg.apiKey, body));
    },
  },
  {
    name: "ghl_update_task",
    description: "Update a task (mark complete, change due date, reassign).",
    parameters: {
      type: "object",
      properties: {
        contactId: { type: "string", description: "Contact ID" },
        taskId: { type: "string", description: "Task ID" },
        title: { type: "string" },
        body: { type: "string" },
        dueDate: { type: "string" },
        completed: { type: "boolean", description: "Mark task as completed" },
        assignedTo: { type: "string" },
      },
      required: ["contactId", "taskId"],
    },
    execute: (p, cfg) => {
      const { contactId, taskId, ...fields } = p;
      return ok(ghlFetch("PUT", `/contacts/${contactId}/tasks/${taskId}`, cfg.apiKey, fields as Record<string, unknown>));
    },
  },

  // ── NOTES ─────────────────────────────────────────────────────────
  {
    name: "ghl_list_notes",
    description: "List all notes for a contact.",
    parameters: {
      type: "object",
      properties: {
        contactId: { type: "string", description: "Contact ID" },
      },
      required: ["contactId"],
    },
    execute: (p, cfg) => ok(ghlFetch("GET", `/contacts/${p.contactId}/notes`, cfg.apiKey)),
  },
  {
    name: "ghl_create_note",
    description: "Add a note to a contact's record.",
    parameters: {
      type: "object",
      properties: {
        contactId: { type: "string", description: "Contact ID" },
        body: { type: "string", description: "Note content" },
      },
      required: ["contactId", "body"],
    },
    execute: (p, cfg) => ok(ghlFetch("POST", `/contacts/${p.contactId}/notes`, cfg.apiKey, { body: p.body })),
  },
];

// ─── Plugin Registration ─────────────────────────────────────────────

const ghlPlugin = {
  id: "gohighlevel",
  name: "GoHighLevel CRM",
  description: "Direct REST API access to GoHighLevel — contacts, conversations, calendars, pipelines, tasks, notes.",

  register(api: OpenClawPluginApi) {
    const config = resolveConfig(api.pluginConfig ?? {});

    if (!config.enabled) {
      api.logger.debug?.("[gohighlevel] Plugin disabled");
      return;
    }

    if (!config.apiKey) {
      api.logger.warn("[gohighlevel] No API key found. Set GHL_API_KEY env var or plugins.gohighlevel.apiKey in config.");
      return;
    }

    if (!config.locationId) {
      api.logger.warn("[gohighlevel] No location ID found. Set GHL_LOCATION_ID env var or plugins.gohighlevel.locationId in config.");
      return;
    }

    // Register system context so the agent knows GHL tools are available
    api.on("before_prompt_build", () => ({
      prependSystemContext: `<gohighlevel>
You have direct access to GoHighLevel CRM via the ghl_* tools. Use them proactively:
- Search contacts before every conversation to pull existing history
- Update contact records after every interaction
- Check calendar availability before offering time slots
- Create opportunities when leads are qualified
- Send SMS/Email/WhatsApp messages through GHL
- Tag contacts to trigger GHL automations

Location ID: ${config.locationId}
Available tools: ${tools.map(t => t.name).join(", ")}
</gohighlevel>`,
    }));

    // Register all GHL tools
    for (const tool of tools) {
      api.registerTool({
        name: tool.name,
        label: tool.name.replace(/^ghl_/, "GHL: ").replace(/_/g, " "),
        description: tool.description,
        parameters: tool.parameters,

        async execute(_toolCallId: string, params: Record<string, unknown>) {
          try {
            return tool.execute(params, config);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            api.logger.error(`[gohighlevel] ${tool.name} failed: ${msg}`);
            return err(msg);
          }
        },
      });
    }

    api.logger.info(`[gohighlevel] Ready — ${tools.length} tools registered (location: ${config.locationId})`);
  },
};

export default ghlPlugin;
