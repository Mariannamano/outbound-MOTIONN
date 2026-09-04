import { callMcpTool, type McpToolCallResult } from "../mcpClient.js";
import type { Connector, SearchOptions, UnifiedResult } from "../types.js";

const MCP_URL = process.env.OPENFUNNEL_MCP_URL ?? "https://agents.openfunnel.dev/mcp";

function arrayFromUnknown(value: unknown): Record<string, unknown>[] | undefined {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  if (value && typeof value === "object") {
    for (const key of ["results", "items", "data", "findings"]) {
      const candidate = (value as Record<string, unknown>)[key];
      if (Array.isArray(candidate)) return candidate as Record<string, unknown>[];
    }
  }
  return undefined;
}

/**
 * OpenFunnel's tool schema and response shape aren't fixed ahead of time (it's
 * discovered live via listTools), so results are normalized defensively:
 * structured content first, then JSON found in text blocks, then raw text as
 * a last resort.
 */
function extractItems(result: McpToolCallResult): Record<string, unknown>[] {
  const fromStructured = arrayFromUnknown(result.structuredContent);
  if (fromStructured) return fromStructured;

  const items: Record<string, unknown>[] = [];
  for (const block of result.content) {
    if (block.type !== "text" || !block.text) continue;
    try {
      const parsed: unknown = JSON.parse(block.text);
      const arr = arrayFromUnknown(parsed);
      if (arr) {
        items.push(...arr);
        continue;
      }
      if (parsed && typeof parsed === "object") {
        items.push(parsed as Record<string, unknown>);
        continue;
      }
    } catch {
      // Not JSON: fall through and treat the raw text as one finding.
    }
    items.push({ text: block.text });
  }
  return items;
}

function pickString(item: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

function toResult(item: Record<string, unknown>): UnifiedResult {
  const title =
    pickString(item, ["title", "headline", "name", "full_name"]) ??
    (typeof item.text === "string" ? item.text.slice(0, 80) : "OpenFunnel finding");
  return {
    source: "openfunnel",
    id: pickString(item, ["id", "uuid"]),
    title,
    snippet: pickString(item, ["summary", "snippet", "description", "text"]),
    url: pickString(item, ["url", "source_url", "link"]),
    timestamp: pickString(item, ["timestamp", "published_at", "created_at"]),
    raw: item,
  };
}

/** OpenFunnel runs agentic research (signals, news, hiring, funding) over a target account or prospect. */
export const openfunnelConnector: Connector = {
  id: "openfunnel",
  name: "OpenFunnel",
  description: "Agentic account and prospect research findings from OpenFunnel's hosted MCP server.",

  isConfigured() {
    return Boolean(process.env.OPENFUNNEL_API_KEY);
  },

  async search({ query, limit = 10 }: SearchOptions): Promise<UnifiedResult[]> {
    const apiKey = process.env.OPENFUNNEL_API_KEY!;
    const result = await callMcpTool({
      url: MCP_URL,
      headers: { Authorization: `Bearer ${apiKey}` },
      toolName: process.env.OPENFUNNEL_MCP_TOOL_NAME,
      toolNameHints: ["search", "research", "find", "query"],
      args: { query, limit },
    });

    return extractItems(result).slice(0, limit).map(toResult);
  },
};
