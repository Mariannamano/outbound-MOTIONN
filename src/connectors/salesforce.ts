import { requestJson } from "../httpClient.js";
import type { Connector, SearchOptions, UnifiedResult } from "../types.js";

const API_VERSION = process.env.SALESFORCE_API_VERSION ?? "v60.0";

interface SoslRecord {
  Id: string;
  attributes: { type: string };
  Name?: string;
  Email?: string;
  StageName?: string;
}

interface SoslSearchResponse {
  searchRecords: SoslRecord[];
}

function escapeSosl(query: string): string {
  return query.replace(/["\\?*!~^:{}[\]()+\-]/g, "\\$&");
}

function toResult(record: SoslRecord): UnifiedResult {
  const instanceUrl = process.env.SALESFORCE_INSTANCE_URL?.replace(/\/$/, "");
  const details = [record.Email, record.StageName].filter(Boolean).join(" · ");
  return {
    source: "salesforce",
    id: record.Id,
    title: record.Name ?? `${record.attributes.type} ${record.Id}`,
    snippet: `${record.attributes.type}${details ? ` — ${details}` : ""}`,
    url: instanceUrl ? `${instanceUrl}/${record.Id}` : undefined,
    raw: record as unknown as Record<string, unknown>,
  };
}

/**
 * Searches Accounts, Contacts, and Opportunities in one round trip using SOSL
 * (Salesforce's cross-object free-text search), rather than issuing separate
 * SOQL queries per object.
 */
export const salesforceConnector: Connector = {
  id: "salesforce",
  name: "Salesforce",
  description: "Accounts, contacts, and opportunities from Salesforce CRM.",

  isConfigured() {
    return Boolean(
      process.env.SALESFORCE_INSTANCE_URL && process.env.SALESFORCE_ACCESS_TOKEN,
    );
  },

  async search({ query, limit = 10 }: SearchOptions): Promise<UnifiedResult[]> {
    const instanceUrl = process.env.SALESFORCE_INSTANCE_URL!.replace(/\/$/, "");
    const token = process.env.SALESFORCE_ACCESS_TOKEN!;
    const sosl =
      `FIND {${escapeSosl(query)}} IN ALL FIELDS RETURNING ` +
      `Account(Id, Name LIMIT ${limit}), ` +
      `Contact(Id, Name, Email LIMIT ${limit}), ` +
      `Opportunity(Id, Name, StageName LIMIT ${limit})`;

    const data = await requestJson<SoslSearchResponse>(
      `${instanceUrl}/services/data/${API_VERSION}/search`,
      {
        query: { q: sosl },
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    return data.searchRecords.slice(0, limit).map(toResult);
  },
};
