import { parseImdbCsv } from "./csv";
import {
  extractImdbId,
  isImdbId,
  normalizeTitleType,
  parseNumber,
  parseYear,
  titleUrl,
} from "./normalize";
import type { WatchlistItem } from "./types";

export type PasteFormat = "csv" | "json" | "links";

export interface PasteResult {
  items: WatchlistItem[];
  format: PasteFormat;
  /** True when the items lack the genre/rating data the filters use. */
  partial: boolean;
}

export class PasteError extends Error {}

/** A row as the bookmarklet collects it from the rendered IMDb page. */
interface CollectedRow {
  id?: unknown;
  title?: unknown;
  year?: unknown;
  rating?: unknown;
  runtime?: unknown;
  type?: unknown;
  genres?: unknown;
}

function toItem(row: CollectedRow): WatchlistItem | null {
  // Strict here on purpose: a malformed id like "tt0000000x" must be dropped,
  // not loosely matched into a different, real title.
  const raw = typeof row.id === "string" ? row.id.trim() : "";
  const id = isImdbId(raw) ? raw : null;
  const title = typeof row.title === "string" ? row.title.trim() : "";
  if (!id || !title) return null;

  const genres = Array.isArray(row.genres)
    ? row.genres.filter((genre): genre is string => typeof genre === "string" && genre.length > 0)
    : [];

  const { label, category } = normalizeTitleType(
    typeof row.type === "string" ? row.type : null,
  );

  const runtime = typeof row.runtime === "number" ? row.runtime : parseNumber(String(row.runtime ?? ""));
  const rating = typeof row.rating === "number" ? row.rating : parseNumber(String(row.rating ?? ""));

  return {
    id,
    title,
    year: parseYear(String(row.year ?? "")),
    titleType: label,
    category,
    imdbRating: rating !== null && rating > 0 && rating <= 10 ? rating : null,
    numVotes: null,
    runtime: runtime !== null && runtime > 0 ? Math.round(runtime) : null,
    genres,
    directors: [],
    url: titleUrl(id),
    addedAt: null,
    releaseDate: null,
  };
}

function parseJson(text: string): WatchlistItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new PasteError("That looked like JSON but could not be read.");
  }

  const rows = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { items?: unknown }).items)
      ? ((parsed as { items: unknown[] }).items)
      : null;

  if (!rows) throw new PasteError("That JSON has no list of titles in it.");

  const seen = new Set<string>();
  const items: WatchlistItem[] = [];
  for (const row of rows) {
    if (typeof row !== "object" || row === null) continue;
    const item = toItem(row as CollectedRow);
    if (item && !seen.has(item.id)) {
      seen.add(item.id);
      items.push(item);
    }
  }
  return items;
}

/**
 * Freeform text: IMDb links, bare tt-ids, or either followed by a title.
 * Anything without a tt-id is skipped, since a bare name can't be resolved
 * without guessing which title was meant.
 */
function parseLinks(text: string): WatchlistItem[] {
  const seen = new Set<string>();
  const items: WatchlistItem[] = [];

  for (const line of text.split(/\r?\n/)) {
    const id = extractImdbId(line);
    if (!id || seen.has(id)) continue;
    seen.add(id);

    // Strip the url and id first: the digits inside "tt0903747" would
    // otherwise be read as the year.
    const rest = line.replace(/https?:\/\/\S+/g, " ").replace(/tt\d{6,10}/g, " ");

    const title =
      rest
        .replace(/^[\s\-–—•|,:.\d)]+/, "")
        .replace(/\s+/g, " ")
        .trim() || id;

    items.push({
      id,
      title,
      year: parseYear(rest),
      titleType: "Unknown",
      category: "other",
      imdbRating: null,
      numVotes: null,
      runtime: null,
      genres: [],
      directors: [],
      url: titleUrl(id),
      addedAt: null,
      releaseDate: null,
    });
  }

  return items;
}

/**
 * Accepts whatever the viewer pasted: the bookmarklet's JSON, the contents of
 * an IMDb CSV export, or a rough list of links and ids. The shape is sniffed
 * rather than selected, so there is one box instead of three.
 */
export function parsePastedWatchlist(input: string): PasteResult {
  const text = input.trim();
  if (!text) throw new PasteError("Nothing to import — paste something first.");

  if (text.startsWith("{") || text.startsWith("[")) {
    const items = parseJson(text);
    if (!items.length) throw new PasteError("No titles found in that JSON.");
    return { items, format: "json", partial: items.every((item) => !item.genres.length) };
  }

  // An IMDb export always has Const and Title columns in its header line.
  const header = text.slice(0, 500).toLowerCase();
  if (header.includes("const") && header.includes("title")) {
    const items = parseImdbCsv(text);
    return { items, format: "csv", partial: false };
  }

  const items = parseLinks(text);
  if (!items.length) {
    throw new PasteError(
      "No IMDb titles found in that. Paste the bookmarklet's output, the contents of a CSV export, or a list of imdb.com/title/… links.",
    );
  }
  return { items, format: "links", partial: true };
}
