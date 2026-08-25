import { NextResponse } from "next/server";
import { UpstreamError } from "@/lib/http";
import { importList, parseListRef } from "@/lib/imdbList";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Importing a list is a read, so it is available as GET ?source=… too. */
export async function GET(request: Request) {
  return importFrom(new URL(request.url).searchParams.get("source") ?? "");
}

export async function POST(request: Request) {
  let body: { source?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  return importFrom(typeof body.source === "string" ? body.source : "");
}

async function importFrom(source: string) {
  const ref = parseListRef(source);
  if (!ref) {
    return NextResponse.json(
      {
        error:
          "Paste an IMDb watchlist or list link. That is a share link (imdb.com/user/p.…/watchlist/), a ur12345678 account id, or an ls123456789 list id.",
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
    const diagnostics = error instanceof UpstreamError ? error.diagnostics : undefined;
    return NextResponse.json(
      diagnostics ? { error: message, diagnostics } : { error: message },
      { status: status === 404 ? 404 : status },
    );
  }
}
