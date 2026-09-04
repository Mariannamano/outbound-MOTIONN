import { requestJson } from "../httpClient.js";
import type { Connector, SearchOptions, UnifiedResult } from "../types.js";

const BASE_URL = process.env.SALESFINITY_BASE_URL ?? "https://api.salesfinity.co/v1";

interface SalesfinityCallLog {
  id: string;
  contactName?: string;
  contactCompany?: string;
  disposition?: string;
  summary?: string;
  recordingUrl?: string;
  callDate?: string;
}

interface SalesfinityCallLogsResponse {
  data: SalesfinityCallLog[];
}

function matches(query: string, log: SalesfinityCallLog): boolean {
  const haystack = [log.contactName, log.contactCompany, log.disposition, log.summary]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function toResult(log: SalesfinityCallLog): UnifiedResult {
  return {
    source: "salesfinity",
    id: log.id,
    title: log.contactName ?? `Call ${log.id}`,
    snippet: [log.contactCompany, log.disposition, log.summary].filter(Boolean).join(" · "),
    url: log.recordingUrl,
    timestamp: log.callDate,
    raw: log as unknown as Record<string, unknown>,
  };
}

/**
 * Salesfinity's call-log endpoint has no free-text search parameter, so this
 * pages recent logs and filters client-side against contact/company/summary
 * fields. Verify field names against your account's API version if results
 * look wrong.
 */
export const salesfinityConnector: Connector = {
  id: "salesfinity",
  name: "Salesfinity",
  description: "Dialer call logs, dispositions, and call summaries from Salesfinity.",

  isConfigured() {
    return Boolean(process.env.SALESFINITY_API_KEY);
  },

  async search({ query, limit = 10 }: SearchOptions): Promise<UnifiedResult[]> {
    const apiKey = process.env.SALESFINITY_API_KEY!;
    const data = await requestJson<SalesfinityCallLogsResponse>(`${BASE_URL}/call-logs`, {
      query: { limit: 100 },
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    return data.data.filter((log) => matches(query, log)).slice(0, limit).map(toResult);
  },
};
