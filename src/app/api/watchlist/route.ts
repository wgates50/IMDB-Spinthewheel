import { NextResponse } from "next/server";
import { UpstreamError } from "@/lib/http";
import { importList, parseListRef } from "@/lib/imdbList";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { source?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const source = typeof body.source === "string" ? body.source : "";
  const ref = parseListRef(source);
  if (!ref) {
    return NextResponse.json(
      {
        error:
          "Paste an IMDb watchlist or list link, or just the id — it looks like ur12345678 or ls123456789.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await importList(ref);
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof UpstreamError ? error.status : 502;
    const message =
      error instanceof Error ? error.message : "Could not import that list from IMDb.";
    return NextResponse.json({ error: message }, { status: status === 404 ? 404 : status });
  }
}
