import { requestJson } from "../httpClient.js";
import type { Connector, SearchOptions, UnifiedResult } from "../types.js";

const BASE_URL = process.env.OPENFUNNEL_BASE_URL ?? "https://api.openfunnel.ai/v1";

interface OpenFunnelFinding {
  id: string;
  headline?: string;
  summary?: string;
  source_url?: string;
  published_at?: string;
}

interface OpenFunnelSearchResponse {
  results: OpenFunnelFinding[];
}

function toResult(finding: OpenFunnelFinding): UnifiedResult {
  return {
    source: "openfunnel",
    id: finding.id,
    title: finding.headline ?? `Finding ${finding.id}`,
    snippet: finding.summary,
    url: finding.source_url,
    timestamp: finding.published_at,
    raw: finding as unknown as Record<string, unknown>,
  };
}

/** OpenFunnel runs agentic research (signals, news, hiring, funding) over a target account or prospect. */
export const openfunnelConnector: Connector = {
  id: "openfunnel",
  name: "OpenFunnel",
  description: "Agentic account and prospect research findings from OpenFunnel.",

  isConfigured() {
    return Boolean(process.env.OPENFUNNEL_API_KEY);
  },

  async search({ query, limit = 10 }: SearchOptions): Promise<UnifiedResult[]> {
    const apiKey = process.env.OPENFUNNEL_API_KEY!;
    const data = await requestJson<OpenFunnelSearchResponse>(`${BASE_URL}/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: { query, limit },
    });

    return (data.results ?? []).slice(0, limit).map(toResult);
  },
};
