#!/usr/bin/env node
/**
 * TrustGraph MCP server.
 * Tools: trust_get_agent_score, trust_get_skill_score, trust_health, trust_emit_event, trust_emit_events_batch
 * Read tools require no key; write tools require TRUSTGRAPH_WRITE_KEY only if TRUSTGRAPH_ENFORCE_WRITE_KEY=true.
 */
import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getAgentScore, getSkillScore, health } from "../services/trust-read.js";
import { ingestEvent, ingestEventBatch } from "../events/ingest.js";
import { config } from "../config.js";

const WRITE_KEY_REQUIRED = "This server requires a write key";

const server = new Server(
  {
    name: "trustgraph",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "trust_get_agent_score",
      description: "Get trust scores for an agent (all skills) in a time window. Use before accepting work from a requester or before delegating work.",
      inputSchema: {
        type: "object",
        properties: {
          agentId: { type: "string", description: "Agent identifier" },
          window: {
            type: "string",
            enum: ["7d", "30d", "180d", "all"],
            description: "Score window (default 30d)",
          },
        },
        required: ["agentId"],
      },
    },
    {
      name: "trust_get_skill_score",
      description: "Get trust scores for an agent on a specific skill. Use for skill-specific delegation or risk gating.",
      inputSchema: {
        type: "object",
        properties: {
          agentId: { type: "string", description: "Agent identifier" },
          skillId: { type: "string", description: "Skill identifier" },
          window: {
            type: "string",
            enum: ["7d", "30d", "180d", "all"],
            description: "Score window (default 30d)",
          },
        },
        required: ["agentId", "skillId"],
      },
    },
    {
      name: "trust_health",
      description: "Check TrustGraph service and database connectivity.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "trust_emit_event",
      description: "Emit a single trust event (append-only). Requires write key if server enforces it.",
      inputSchema: {
        type: "object",
        properties: {
          subjectAgentId: { type: "string" },
          actorAgentId: { type: "string" },
          skillId: { type: "string" },
          source: { type: "string" },
          eventType: { type: "string" },
          outcome: { type: "string" },
          severity: { type: "number" },
          valueUsdMicros: { type: "number" },
          occurredAt: { type: "string" },
          externalRefType: { type: "string" },
          externalRefId: { type: "string" },
          evidence: { type: "object" },
          writeKey: { type: "string", description: "TRUSTGRAPH_WRITE_KEY if enforced" },
        },
        required: ["subjectAgentId", "source", "eventType", "outcome", "severity", "occurredAt"],
      },
    },
    {
      name: "trust_emit_events_batch",
      description: "Emit multiple trust events. Requires write key if server enforces it.",
      inputSchema: {
        type: "object",
        properties: {
          events: {
            type: "array",
            items: {
              type: "object",
              properties: {
                subjectAgentId: { type: "string" },
                actorAgentId: { type: "string" },
                skillId: { type: "string" },
                source: { type: "string" },
                eventType: { type: "string" },
                outcome: { type: "string" },
                severity: { type: "number" },
                valueUsdMicros: { type: "number" },
                occurredAt: { type: "string" },
                externalRefType: { type: "string" },
                externalRefId: { type: "string" },
                evidence: { type: "object" },
              },
              required: ["subjectAgentId", "source", "eventType", "outcome", "severity", "occurredAt"],
            },
          },
          writeKey: { type: "string" },
        },
        required: ["events"],
      },
    },
  ],
}));

function getWriteKeyFromRequest(args: Record<string, unknown>): string | null {
  const key = args?.writeKey;
  return typeof key === "string" ? key : null;
}

function checkWriteKey(args: Record<string, unknown>): { allowed: boolean; message?: string } {
  if (!config.enforceWriteKey) return { allowed: true };
  const key = getWriteKeyFromRequest(args);
  if (key === config.writeKey) return { allowed: true };
  return { allowed: false, message: WRITE_KEY_REQUIRED };
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const params = (args ?? {}) as Record<string, unknown>;

  try {
    if (name === "trust_get_agent_score") {
      const agentId = params.agentId as string;
      const window = (params.window as string) || "30d";
      const result = await getAgentScore(agentId, window);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: false,
      };
    }

    if (name === "trust_get_skill_score") {
      const agentId = params.agentId as string;
      const skillId = params.skillId as string;
      const window = (params.window as string) || "30d";
      const result = await getSkillScore(agentId, skillId, window);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: false,
      };
    }

    if (name === "trust_health") {
      const result = await health();
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: false,
      };
    }

    if (name === "trust_emit_event") {
      const auth = checkWriteKey(params);
      if (!auth.allowed) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: auth.message }) }],
          isError: true,
        };
      }
      const input = {
        subjectAgentId: params.subjectAgentId as string,
        actorAgentId: (params.actorAgentId as string) ?? null,
        skillId: (params.skillId as string) ?? null,
        source: params.source as string,
        eventType: params.eventType as string,
        outcome: params.outcome as string,
        severity: Number(params.severity),
        valueUsdMicros: (params.valueUsdMicros as number) ?? null,
        occurredAt: params.occurredAt as string,
        externalRefType: (params.externalRefType as string) ?? null,
        externalRefId: (params.externalRefId as string) ?? null,
        evidence: (params.evidence as Record<string, unknown>) ?? null,
      };
      const { id } = await ingestEvent(input);
      return {
        content: [{ type: "text", text: JSON.stringify({ id }) }],
        isError: false,
      };
    }

    if (name === "trust_emit_events_batch") {
      const auth = checkWriteKey(params);
      if (!auth.allowed) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: auth.message }) }],
          isError: true,
        };
      }
      const events = (params.events as Record<string, unknown>[]) ?? [];
      const inputEvents = events.map((e) => ({
        subjectAgentId: e.subjectAgentId as string,
        actorAgentId: (e.actorAgentId as string) ?? null,
        skillId: (e.skillId as string) ?? null,
        source: e.source as string,
        eventType: e.eventType as string,
        outcome: e.outcome as string,
        severity: Number(e.severity),
        valueUsdMicros: (e.valueUsdMicros as number) ?? null,
        occurredAt: e.occurredAt as string,
        externalRefType: (e.externalRefType as string) ?? null,
        externalRefId: (e.externalRefId as string) ?? null,
        evidence: (e.evidence as Record<string, unknown>) ?? null,
      }));
      const result = await ingestEventBatch(inputEvents);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: false,
      };
    }

    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
