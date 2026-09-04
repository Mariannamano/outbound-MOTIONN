export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export interface JsonRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

/** Thin fetch wrapper: builds the query string, sets JSON headers, and throws HttpError on non-2xx. */
export async function requestJson<T>(
  url: string,
  options: JsonRequestOptions = {},
): Promise<T> {
  const target = new URL(url);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) target.searchParams.set(key, String(value));
  }

  const response = await fetch(target, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new HttpError(
      response.status,
      `Request to ${target.hostname} failed with ${response.status}: ${text.slice(0, 300)}`,
    );
  }

  return (await response.json()) as T;
}
