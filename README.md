# outbound-motionn

An MCP server that unifies search across outbound data sources so an LLM can
query all of them through one interface instead of juggling separate tools
and result formats.

## Connected sources

| Source | What it searches | Required env vars |
| --- | --- | --- |
| Salesforce | Accounts, Contacts, Opportunities (via SOSL) | `SALESFORCE_INSTANCE_URL`, `SALESFORCE_ACCESS_TOKEN` |
| Salesfinity | Dialer call logs, dispositions, summaries | `SALESFINITY_API_KEY` |
| Fathom | Meeting recordings and summaries | `FATHOM_API_KEY` |
| Amplemarket | People and company prospecting records | `AMPLEMARKET_API_KEY` |
| OpenFunnel | Agentic account/prospect research findings (via OpenFunnel's own hosted MCP server) | `OPENFUNNEL_API_KEY` |

A source is only queried when its env vars are set; missing sources are
reported back as `skipped` rather than causing the whole search to fail.

## Tools exposed over MCP

- `list_sources` — lists every connector and whether it's currently configured.
- `search_all_sources` — runs one free-text query against every configured
  source in parallel and returns a single merged, normalized result list
  (interleaved round-robin across sources, optionally capped with `limit`).
- `search_<source>` (e.g. `search_salesforce`) — queries a single source
  directly, for when the caller already knows where to look.

Every result is normalized to the same shape regardless of source:

```ts
{
  source: "salesforce" | "salesfinity" | "fathom" | "amplemarket" | "openfunnel",
  id?: string,
  title: string,
  snippet?: string,
  url?: string,
  timestamp?: string,
  raw?: Record<string, unknown>, // original source-specific fields
}
```

## Setup

```bash
npm install
cp .env.example .env   # fill in credentials for the sources you use
npm run build
npm start               # runs the MCP server over stdio
```

For local development without a build step: `npm run dev`.

Point any MCP client at the built server with a stdio transport, e.g. in a
client config:

```json
{
  "mcpServers": {
    "outbound-motionn": {
      "command": "node",
      "args": ["/path/to/outbound-motionn/dist/server.js"],
      "env": {
        "SALESFORCE_INSTANCE_URL": "...",
        "SALESFORCE_ACCESS_TOKEN": "..."
      }
    }
  }
}
```

## Adding a new connector

1. Add a file under `src/connectors/` implementing the `Connector` interface
   from `src/types.ts` (`id`, `name`, `description`, `isConfigured`, `search`).
2. Register it in `src/connectors/index.ts`'s `allConnectors` array — it then
   automatically gets picked up by `search_all_sources` and gets its own
   `search_<id>` tool.
3. Add its id to `CONNECTOR_IDS` in `src/types.ts`.

## Notes on API assumptions

Salesforce's SOSL search endpoint is stable, documented, and used as-is.
Salesfinity, Fathom, and Amplemarket's exact REST shapes vary by account/plan
and aren't all publicly documented, so those connectors use a best-effort
endpoint/field mapping with a configurable base URL (`<SOURCE>_BASE_URL`).
Verify against your account's actual API docs and adjust the small
`toResult`/matching logic in the relevant connector file if field names
differ.

OpenFunnel is different: it's reached as an MCP server, not a REST API
(`OPENFUNNEL_MCP_URL`, default `https://agents.openfunnel.dev/mcp`). The
connector (`src/mcpClient.ts` + `src/connectors/openfunnel.ts`) connects as an
MCP client, calls `listTools` to discover what's actually exposed, and picks a
tool by matching name/description against `["search", "research", "find",
"query"]` (override with `OPENFUNNEL_MCP_TOOL_NAME` if that heuristic picks
the wrong one). It then maps a logical `{ query, limit }` onto whatever the
chosen tool's input schema actually calls those fields, and normalizes
structured content, or JSON/text found in the response, into `UnifiedResult`s.
Point `OPENFUNNEL_MCP_URL` at a different environment if needed, and set
`OPENFUNNEL_API_KEY` to whatever bearer token OpenFunnel issues for
programmatic MCP access.

## Testing

```bash
npm test        # vitest
npm run typecheck
```
