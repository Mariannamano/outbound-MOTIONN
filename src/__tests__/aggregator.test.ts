import { describe, expect, it } from "vitest";
import { searchAllSources } from "../aggregator.js";
import type { Connector, UnifiedResult } from "../types.js";

function fakeConnector(
  id: Connector["id"],
  overrides: Partial<Connector> = {},
): Connector {
  return {
    id,
    name: id,
    description: id,
    isConfigured: () => true,
    search: async () => [],
    ...overrides,
  };
}

function result(source: Connector["id"], title: string): UnifiedResult {
  return { source, title };
}

describe("searchAllSources", () => {
  it("skips connectors that are not configured", async () => {
    const configured = fakeConnector("salesforce", {
      search: async () => [result("salesforce", "Acme Inc")],
    });
    const unconfigured = fakeConnector("fathom", { isConfigured: () => false });

    const outcome = await searchAllSources([configured, unconfigured], { query: "acme" });

    expect(outcome.skipped).toEqual(["fathom"]);
    expect(outcome.results).toEqual([result("salesforce", "Acme Inc")]);
    expect(outcome.errors).toEqual([]);
  });

  it("captures a connector's error without failing the whole search", async () => {
    const failing = fakeConnector("amplemarket", {
      search: async () => {
        throw new Error("boom");
      },
    });
    const succeeding = fakeConnector("salesforce", {
      search: async () => [result("salesforce", "Acme Inc")],
    });

    const outcome = await searchAllSources([failing, succeeding], { query: "acme" });

    expect(outcome.errors).toEqual([{ source: "amplemarket", message: "boom" }]);
    expect(outcome.results).toEqual([result("salesforce", "Acme Inc")]);
  });

  it("interleaves results round-robin instead of grouping by source", async () => {
    const a = fakeConnector("salesforce", {
      search: async () => [
        result("salesforce", "SF-1"),
        result("salesforce", "SF-2"),
        result("salesforce", "SF-3"),
      ],
    });
    const b = fakeConnector("fathom", {
      search: async () => [result("fathom", "F-1")],
    });

    const outcome = await searchAllSources([a, b], { query: "x" });

    expect(outcome.results.map((r) => r.title)).toEqual(["SF-1", "F-1", "SF-2", "SF-3"]);
  });

  it("applies the overall limit after merging", async () => {
    const a = fakeConnector("salesforce", {
      search: async () => [result("salesforce", "SF-1"), result("salesforce", "SF-2")],
    });
    const b = fakeConnector("fathom", {
      search: async () => [result("fathom", "F-1"), result("fathom", "F-2")],
    });

    const outcome = await searchAllSources([a, b], { query: "x", limit: 2 });

    expect(outcome.results).toHaveLength(2);
  });
});
