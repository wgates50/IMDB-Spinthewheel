import { NextResponse } from "next/server";
import { parseListRef } from "@/lib/imdbList";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BROWSER_HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "accept-language": "en-US,en;q=0.9",
  accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
};

async function probe(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      ...init,
      redirect: "follow",
      signal: controller.signal,
      headers: { ...BROWSER_HEADERS, ...(init.headers ?? {}) },
      cache: "no-store",
    });
    const body = await response.text();
    return {
      url,
      status: response.status,
      finalUrl: response.url,
      contentType: response.headers.get("content-type"),
      length: body.length,
      ttIds: (body.match(/tt\d{7,9}/g) ?? []).length,
      lsIds: [...new Set(body.match(/ls\d{6,12}/g) ?? [])].slice(0, 5),
      urIds: [...new Set(body.match(/ur\d{5,12}/g) ?? [])].slice(0, 5),
      // Small bodies are shown in full: this is how we learn what IMDb is
      // actually saying rather than inferring it from counts.
      head: body.slice(0, 2500),
    };
  } catch (error) {
    return { url, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

/** TEMPORARY probe of candidate IMDb endpoints. Removed before merge. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const source = params.get("source") ?? "";
  const only = params.get("only");
  const ref = parseListRef(source);
  if (!ref) return NextResponse.json({ error: "not a list ref" }, { status: 400 });

  const id = ref.id;
  const candidates: Record<string, string> = {
    watchlistPage: `https://www.imdb.com/user/${id}/watchlist/`,
    watchlistExport: `https://www.imdb.com/user/${id}/watchlist/export`,
    listExport: `https://www.imdb.com/list/${id}/export`,
    mobilePage: `https://m.imdb.com/user/${id}/watchlist/`,
    viewDetail: `https://www.imdb.com/user/${id}/watchlist/?view=detail&sort=list_order,asc`,
    noJsPage: `https://www.imdb.com/user/${id}/watchlist/?ref_=nv_usr_wl_all_0`,
  };

  const chosen = only ? { [only]: candidates[only] } : candidates;
  const results = [];
  for (const [name, url] of Object.entries(chosen)) {
    if (!url) continue;
    results.push({ name, ...(await probe(url)) });
  }

  return NextResponse.json({ ref, results });
}
