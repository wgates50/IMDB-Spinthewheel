import { NextResponse } from "next/server";
import { fetchText } from "@/lib/http";
import { parseListRef } from "@/lib/imdbList";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * TEMPORARY. Reports the *shape* of an IMDb list page so the importer can be
 * pointed at the right nodes. Returns structure only, never page content, and
 * only for URLs that parse as an IMDb list. Delete once the importer works.
 */
export async function GET(request: Request) {
  const source = new URL(request.url).searchParams.get("source") ?? "";
  const ref = parseListRef(source);
  if (!ref) return NextResponse.json({ error: "not a list ref" }, { status: 400 });

  const url =
    ref.kind === "list"
      ? `https://www.imdb.com/list/${ref.id}/`
      : `https://www.imdb.com/user/${ref.id}/watchlist/`;

  let html: string;
  try {
    html = await fetchText(url);
  } catch (error) {
    return NextResponse.json({
      url,
      fetchError: error instanceof Error ? error.message : String(error),
    });
  }

  const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)].map((m) => ({
    attrs: m[1].trim().slice(0, 120),
    length: m[2].length,
  }));

  const jsonScripts = [
    ...html.matchAll(/<script[^>]+type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi),
  ].map((m) => {
    try {
      const parsed = JSON.parse(m[1]);
      return { ok: true, length: m[1].length, topKeys: Object.keys(parsed).slice(0, 20) };
    } catch {
      return { ok: false, length: m[1].length, topKeys: [] };
    }
  });

  const ttMatches = html.match(/tt\d{7,9}/g) ?? [];

  return NextResponse.json({
    url,
    htmlLength: html.length,
    scriptCount: scripts.length,
    biggestScripts: scripts.sort((a, b) => b.length - a.length).slice(0, 8),
    jsonScripts,
    ttIdCount: ttMatches.length,
    uniqueTtIds: [...new Set(ttMatches)].length,
    sampleTtIds: [...new Set(ttMatches)].slice(0, 10),
    markers: {
      titleListItemSearch: html.includes("titleListItemSearch"),
      nextData: html.includes("__NEXT_DATA__"),
      ldJson: html.includes("application/ld+json"),
      titleText: html.includes("titleText"),
      signInWall: /sign in|Sign In/.test(html.slice(0, 20000)),
      notFound: html.includes("404") && html.length < 60000,
    },
  });
}
