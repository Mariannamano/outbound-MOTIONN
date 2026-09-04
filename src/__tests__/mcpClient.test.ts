import { describe, expect, it } from "vitest";
import { mapArgsToSchema, pickTool, type McpTool } from "../mcpClient.js";

describe("pickTool", () => {
  it("returns the only tool when there are no hints", () => {
    const tools: McpTool[] = [{ name: "anything" }];
    expect(pickTool(tools, [])).toBe(tools[0]);
  });

  it("matches a hint against the tool name", () => {
    const tools: McpTool[] = [{ name: "list_accounts" }, { name: "search_findings" }];
    expect(pickTool(tools, ["search", "research"])?.name).toBe("search_findings");
  });

  it("matches a hint against the tool description when the name doesn't match", () => {
    const tools: McpTool[] = [
      { name: "list_accounts" },
      { name: "run_query", description: "Runs agentic research over a target account" },
    ];
    expect(pickTool(tools, ["research"])?.name).toBe("run_query");
  });

  it("falls back to the first tool when no hint matches", () => {
    const tools: McpTool[] = [{ name: "list_accounts" }, { name: "get_widgets" }];
    expect(pickTool(tools, ["research"])?.name).toBe("list_accounts");
  });
});

describe("mapArgsToSchema", () => {
  it("maps logical arg names onto the tool's actual schema property names", () => {
    const tool: McpTool = {
      name: "search",
      inputSchema: { properties: { q: {}, max_results: {} }, required: ["q"] },
    };
    expect(mapArgsToSchema({ query: "acme", limit: 5 }, tool)).toEqual({
      q: "acme",
      max_results: 5,
    });
  });

  it("passes args through unchanged when the tool has no input schema", () => {
    const tool: McpTool = { name: "search" };
    expect(mapArgsToSchema({ query: "acme", limit: 5 }, tool)).toEqual({
      query: "acme",
      limit: 5,
    });
  });

  it("throws when a required property can't be inferred from any alias", () => {
    const tool: McpTool = {
      name: "search",
      inputSchema: { properties: { account_id: {} }, required: ["account_id"] },
    };
    expect(() => mapArgsToSchema({ query: "acme" }, tool)).toThrow(/account_id/);
  });
});
