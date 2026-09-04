import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: {
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export interface McpToolContentBlock {
  type: string;
  text?: string;
  [key: string]: unknown;
}

export interface McpToolCallResult {
  toolName: string;
  content: McpToolContentBlock[];
  structuredContent?: unknown;
  isError?: boolean;
}

export interface McpToolCallOptions {
  url: string;
  headers?: Record<string, string>;
  /** Call this exact tool name instead of picking one heuristically. */
  toolName?: string;
  /** Substrings matched against tool name/description when `toolName` isn't set. */
  toolNameHints?: string[];
  /** Logical argument names (e.g. "query", "limit") mapped onto the tool's actual schema. */
  args: Record<string, unknown>;
}

const ARG_ALIASES: Record<string, string[]> = {
  query: ["query", "q", "prompt", "input", "text", "search", "topic", "keywords"],
  limit: ["limit", "max_results", "maxResults", "top_k", "topK", "count", "num_results"],
};

/**
 * Connects to a remote MCP server over Streamable HTTP, picks a tool (by exact
 * name or by matching hints against name/description), calls it with args
 * mapped onto that tool's actual input schema, and closes the connection.
 * Used for source connectors that are themselves MCP servers (e.g. OpenFunnel)
 * rather than plain REST APIs.
 */
export async function callMcpTool(options: McpToolCallOptions): Promise<McpToolCallResult> {
  const client = new Client({ name: "outbound-motionn", version: "0.1.0" }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(new URL(options.url), {
    requestInit: options.headers ? { headers: options.headers } : undefined,
  });

  try {
    await client.connect(transport);

    const { tools } = await client.listTools();
    if (tools.length === 0) {
      throw new Error(`MCP server at ${options.url} exposes no tools.`);
    }

    const tool = options.toolName
      ? tools.find((t) => t.name === options.toolName)
      : pickTool(tools, options.toolNameHints ?? []);

    if (!tool) {
      const available = tools.map((t) => t.name).join(", ");
      throw new Error(
        `Tool "${options.toolName}" not found on ${options.url}. Available tools: ${available}`,
      );
    }

    const args = mapArgsToSchema(options.args, tool);

    const result = await client.callTool({ name: tool.name, arguments: args });
    return {
      toolName: tool.name,
      content: (result.content ?? []) as McpToolContentBlock[],
      structuredContent: result.structuredContent,
      isError: result.isError as boolean | undefined,
    };
  } finally {
    await client.close();
  }
}

export function pickTool(tools: McpTool[], hints: string[]): McpTool | undefined {
  if (hints.length === 0) return tools[0];
  const lowerHints = hints.map((h) => h.toLowerCase());
  return (
    tools.find((t) =>
      lowerHints.some(
        (hint) => t.name.toLowerCase().includes(hint) || (t.description ?? "").toLowerCase().includes(hint),
      ),
    ) ?? tools[0]
  );
}

export function mapArgsToSchema(args: Record<string, unknown>, tool: McpTool): Record<string, unknown> {
  const properties = tool.inputSchema?.properties;
  if (!properties) return args;

  const mapped: Record<string, unknown> = {};
  for (const [argKey, value] of Object.entries(args)) {
    const aliases = ARG_ALIASES[argKey] ?? [argKey];
    const matchedKey = aliases.find((alias) => alias in properties);
    if (matchedKey) mapped[matchedKey] = value;
  }

  const missingRequired = (tool.inputSchema?.required ?? []).filter((key) => !(key in mapped));
  if (missingRequired.length > 0) {
    throw new Error(
      `Tool "${tool.name}" requires ${missingRequired.join(", ")} but no matching argument could be ` +
        `inferred. Its input schema has properties: ${Object.keys(properties).join(", ")}.`,
    );
  }

  return mapped;
}
