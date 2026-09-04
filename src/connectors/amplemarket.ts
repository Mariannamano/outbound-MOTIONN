import { requestJson } from "../httpClient.js";
import type { Connector, SearchOptions, UnifiedResult } from "../types.js";

const BASE_URL = process.env.AMPLEMARKET_BASE_URL ?? "https://api.amplemarket.com";

interface AmplemarketPerson {
  id: string;
  full_name?: string;
  title?: string;
  company_name?: string;
  linkedin_url?: string;
  updated_at?: string;
}

interface AmplemarketSearchResponse {
  people: AmplemarketPerson[];
}

function toResult(person: AmplemarketPerson): UnifiedResult {
  return {
    source: "amplemarket",
    id: person.id,
    title: person.full_name ?? `Person ${person.id}`,
    snippet: [person.title, person.company_name].filter(Boolean).join(" @ "),
    url: person.linkedin_url,
    timestamp: person.updated_at,
    raw: person as unknown as Record<string, unknown>,
  };
}

export const amplemarketConnector: Connector = {
  id: "amplemarket",
  name: "Amplemarket",
  description: "People and company records from Amplemarket's prospecting database.",

  isConfigured() {
    return Boolean(process.env.AMPLEMARKET_API_KEY);
  },

  async search({ query, limit = 10 }: SearchOptions): Promise<UnifiedResult[]> {
    const apiKey = process.env.AMPLEMARKET_API_KEY!;
    const data = await requestJson<AmplemarketSearchResponse>(`${BASE_URL}/people/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: { query, limit },
    });

    return (data.people ?? []).slice(0, limit).map(toResult);
  },
};
