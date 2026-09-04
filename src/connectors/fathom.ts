import { requestJson } from "../httpClient.js";
import type { Connector, SearchOptions, UnifiedResult } from "../types.js";

const BASE_URL = process.env.FATHOM_BASE_URL ?? "https://api.fathom.ai/external/v1";

interface FathomMeeting {
  id: string;
  title?: string;
  summary?: string;
  url?: string;
  createdAt?: string;
}

interface FathomMeetingsResponse {
  items: FathomMeeting[];
}

function matches(query: string, meeting: FathomMeeting): boolean {
  const haystack = [meeting.title, meeting.summary].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function toResult(meeting: FathomMeeting): UnifiedResult {
  return {
    source: "fathom",
    id: meeting.id,
    title: meeting.title ?? `Meeting ${meeting.id}`,
    snippet: meeting.summary,
    url: meeting.url,
    timestamp: meeting.createdAt,
    raw: meeting as unknown as Record<string, unknown>,
  };
}

/**
 * Fathom's list endpoint doesn't take a free-text query, so this pulls recent
 * meetings and filters client-side on title/summary — matching how Fathom's
 * own "search meetings" tool behaves under the hood.
 */
export const fathomConnector: Connector = {
  id: "fathom",
  name: "Fathom",
  description: "Call recordings, summaries, and transcripts from Fathom.",

  isConfigured() {
    return Boolean(process.env.FATHOM_API_KEY);
  },

  async search({ query, limit = 10 }: SearchOptions): Promise<UnifiedResult[]> {
    const apiKey = process.env.FATHOM_API_KEY!;
    const data = await requestJson<FathomMeetingsResponse>(`${BASE_URL}/meetings`, {
      query: { limit: 100 },
      headers: { "X-Api-Key": apiKey },
    });

    return data.items.filter((m) => matches(query, m)).slice(0, limit).map(toResult);
  },
};
