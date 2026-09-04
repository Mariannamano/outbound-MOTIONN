import type { AggregatedSearchResult, Connector, SearchOptions, UnifiedResult } from "./types.js";

/**
 * Runs `query` against every configured connector in parallel and merges the
 * results, interleaving sources round-robin so one chatty source can't push
 * the others off the front of the list. A connector that isn't configured
 * (missing credentials) is reported as skipped rather than failing the whole
 * search; a connector that throws is reported as an error but doesn't stop
 * the others.
 */
export async function searchAllSources(
  connectors: Connector[],
  options: SearchOptions,
): Promise<AggregatedSearchResult> {
  const configured = connectors.filter((c) => c.isConfigured());
  const skipped = connectors.filter((c) => !c.isConfigured()).map((c) => c.id);

  const settled = await Promise.allSettled(
    configured.map((connector) => connector.search(options)),
  );

  const perSource: UnifiedResult[][] = [];
  const errors: AggregatedSearchResult["errors"] = [];

  settled.forEach((outcome, index) => {
    const connector = configured[index];
    if (outcome.status === "fulfilled") {
      perSource.push(outcome.value);
    } else {
      perSource.push([]);
      errors.push({
        source: connector.id,
        message:
          outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
      });
    }
  });

  const results = interleave(perSource);
  if (options.limit) {
    return { results: results.slice(0, options.limit), errors, skipped };
  }
  return { results, errors, skipped };
}

function interleave<T>(lists: T[][]): T[] {
  const merged: T[] = [];
  const maxLength = Math.max(0, ...lists.map((list) => list.length));
  for (let i = 0; i < maxLength; i++) {
    for (const list of lists) {
      if (i < list.length) merged.push(list[i]);
    }
  }
  return merged;
}
