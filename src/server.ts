#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { allConnectors } from "./connectors/index.js";
import { searchAllSources } from "./aggregator.js";
import type { Connector } from "./types.js";

const server = new McpServer({
  name: "outbound-motionn",
  version: "0.1.0",
});

function jsonResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

server.registerTool(
  "list_sources",
  {
    title: "List connected data sources",
    description:
      "Lists every outbound data source this server can search and whether it is currently configured (has credentials set).",
  },
  async () => {
    return jsonResult(
      allConnectors.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        configured: c.isConfigured(),
      })),
    );
  },
);

server.registerTool(
  "search_all_sources",
  {
    title: "Search all outbound data sources",
    description:
      "Runs one free-text query across every configured data source (Salesforce, Salesfinity, Fathom, " +
      "Amplemarket, OpenFunnel) and returns a single merged, normalized result list. Sources without " +
      "credentials configured are reported as skipped rather than causing the search to fail.",
    inputSchema: {
      query: z.string().describe("Free-text search query, e.g. a person, company, or topic."),
      limit: z
        .number()
        .int()
        .positive()
        .max(100)
        .optional()
        .describe("Max total results to return across all sources (default: no cap)."),
    },
  },
  async ({ query, limit }) => {
    const result = await searchAllSources(allConnectors, { query, limit });
    return jsonResult(result);
  },
);

function registerPerConnectorTool(connector: Connector) {
  server.registerTool(
    `search_${connector.id}`,
    {
      title: `Search ${connector.name}`,
      description: `Searches only ${connector.name}: ${connector.description}`,
      inputSchema: {
        query: z.string().describe("Free-text search query."),
        limit: z.number().int().positive().max(100).optional().describe("Max results to return."),
      },
    },
    async ({ query, limit }) => {
      if (!connector.isConfigured()) {
        return jsonResult({
          results: [],
          error: `${connector.name} is not configured. Set its required environment variables.`,
        });
      }
      try {
        const results = await connector.search({ query, limit });
        return jsonResult({ results });
      } catch (error) {
        return jsonResult({
          results: [],
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );
}

for (const connector of allConnectors) {
  registerPerConnectorTool(connector);
}

const transport = new StdioServerTransport();
await server.connect(transport);
