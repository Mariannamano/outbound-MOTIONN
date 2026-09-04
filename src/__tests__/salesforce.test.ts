import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { salesforceConnector } from "../connectors/salesforce.js";

const ORIGINAL_ENV = { ...process.env };

describe("salesforceConnector", () => {
  beforeEach(() => {
    process.env.SALESFORCE_INSTANCE_URL = "https://example.my.salesforce.com";
    process.env.SALESFORCE_ACCESS_TOKEN = "test-token";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  it("is not configured without credentials", () => {
    delete process.env.SALESFORCE_ACCESS_TOKEN;
    expect(salesforceConnector.isConfigured()).toBe(false);
  });

  it("is configured once both env vars are set", () => {
    expect(salesforceConnector.isConfigured()).toBe(true);
  });

  it("sends a SOSL query and normalizes records into UnifiedResult", async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      expect(url.searchParams.get("q")).toContain("FIND {acme}");
      return new Response(
        JSON.stringify({
          searchRecords: [
            {
              Id: "001xx",
              attributes: { type: "Account" },
              Name: "Acme Inc",
            },
            {
              Id: "003xx",
              attributes: { type: "Contact" },
              Name: "Jane Doe",
              Email: "jane@acme.com",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await salesforceConnector.search({ query: "acme" });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(results).toEqual([
      {
        source: "salesforce",
        id: "001xx",
        title: "Acme Inc",
        snippet: "Account",
        url: "https://example.my.salesforce.com/001xx",
        raw: { Id: "001xx", attributes: { type: "Account" }, Name: "Acme Inc" },
      },
      {
        source: "salesforce",
        id: "003xx",
        title: "Jane Doe",
        snippet: "Contact — jane@acme.com",
        url: "https://example.my.salesforce.com/003xx",
        raw: {
          Id: "003xx",
          attributes: { type: "Contact" },
          Name: "Jane Doe",
          Email: "jane@acme.com",
        },
      },
    ]);
  });
});
