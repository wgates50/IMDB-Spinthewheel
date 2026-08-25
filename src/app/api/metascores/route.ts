import { NextResponse } from "next/server";
import { fetchOmdb, metascoreOf, omdbKey } from "@/lib/omdb";
import { isImdbId } from "@/lib/normalize";

export const runtime = "nodejs";

const MAX_IDS = 40;
const CONCURRENCY = 4;

/**
 * Hydrates Metascores for a slice of the watchlist. IMDb exports don't carry
 * them, so the Metascore filter depends on this running in the background.
 * Batches are kept small and lightly parallel to stay inside OMDb's budget.
 */
export async function POST(request: Request) {
  if (!omdbKey()) {
    return NextResponse.json({ error: "No OMDb key configured.", scores: {} }, { status: 503 });
  }

  let body: { ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const ids = Array.isArray(body.ids)
    ? [...new Set(body.ids.filter((id): id is string => typeof id === "string" && isImdbId(id)))].slice(
        0,
        MAX_IDS,
      )
    : [];

  if (!ids.length) return NextResponse.json({ scores: {} });

  const scores: Record<string, number | null> = {};
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < ids.length) {
      const id = ids[cursor];
      cursor += 1;
      scores[id] = metascoreOf(await fetchOmdb(id));
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker));

  return NextResponse.json({ scores });
}
