export interface SearchOptions {
  /** Free-text query to search for. */
  query: string;
  /** Max results to return from this connector. */
  limit?: number;
}

export interface UnifiedResult {
  /** Which connector produced this result, e.g. "salesforce". */
  source: ConnectorId;
  /** Stable identifier within the source system, if available. */
  id?: string;
  /** Short human-readable title, e.g. a contact name or meeting title. */
  title: string;
  /** Short body text useful for the LLM to judge relevance. */
  snippet?: string;
  /** Deep link back into the source system, if available. */
  url?: string;
  /** ISO-8601 timestamp for the underlying record, if available. */
  timestamp?: string;
  /** Arbitrary extra fields specific to the source, passed through as-is. */
  raw?: Record<string, unknown>;
}

export const CONNECTOR_IDS = [
  "salesforce",
  "salesfinity",
  "fathom",
  "amplemarket",
  "openfunnel",
] as const;

export type ConnectorId = (typeof CONNECTOR_IDS)[number];

export interface Connector {
  id: ConnectorId;
  name: string;
  description: string;
  /** Returns false when required credentials are not configured. */
  isConfigured(): boolean;
  search(options: SearchOptions): Promise<UnifiedResult[]>;
}

export interface ConnectorError {
  source: ConnectorId;
  message: string;
}

export interface AggregatedSearchResult {
  results: UnifiedResult[];
  errors: ConnectorError[];
  skipped: ConnectorId[];
}
