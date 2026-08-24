/** Browser-ish headers; IMDb serves a stripped page to obvious bots. */
const BROWSER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "accept-language": "en-US,en;q=0.9",
  accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
} as const;

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function fetchText(
  url: string,
  init: RequestInit = {},
  timeoutMs = 12_000,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { ...BROWSER_HEADERS, ...(init.headers ?? {}) },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new UpstreamError(`Request failed (${response.status})`, response.status);
    }
    return await response.text();
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new UpstreamError("Upstream timed out", 504);
    }
    throw new UpstreamError(
      error instanceof Error ? error.message : "Network request failed",
      502,
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const text = await fetchText(url, init);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new UpstreamError("Upstream returned a non-JSON response", 502);
  }
}
