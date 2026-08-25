import { NextResponse } from "next/server";
import { buildTitleDetails } from "@/lib/details";
import { isImdbId, parseNumber, parseYear } from "@/lib/normalize";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isImdbId(id)) {
    return NextResponse.json({ error: "Not a valid IMDb id." }, { status: 400 });
  }

  const url = new URL(request.url);
  const region = (url.searchParams.get("region") || "US").slice(0, 2).toUpperCase();

  try {
    const details = await buildTitleDetails(id, {
      region,
      fallback: {
        title: url.searchParams.get("title") ?? undefined,
        year: parseYear(url.searchParams.get("year")),
        titleType: url.searchParams.get("type") ?? undefined,
        genres: url.searchParams.get("genres")?.split(",").filter(Boolean),
        imdbRating: parseNumber(url.searchParams.get("rating")),
        runtime: parseNumber(url.searchParams.get("runtime")),
      },
    });
    return NextResponse.json(details);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lookup failed." },
      { status: 502 },
    );
  }
}
