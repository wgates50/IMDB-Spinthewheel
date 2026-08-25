import type { Category } from "./types";

/**
 * IMDb exports have used two spellings for title types over the years: the
 * camelCase GraphQL ids ("tvMiniSeries") in current exports, and spaced labels
 * ("TV Mini Series") in older ones. Both land on the same label here.
 */
const TITLE_TYPES: Record<string, { label: string; category: Category }> = {
  movie: { label: "Movie", category: "movie" },
  short: { label: "Short", category: "movie" },
  tvmovie: { label: "TV Movie", category: "movie" },
  video: { label: "Video", category: "movie" },
  tvseries: { label: "TV Series", category: "tv" },
  tvminiseries: { label: "TV Mini Series", category: "tv" },
  tvepisode: { label: "TV Episode", category: "tv" },
  tvspecial: { label: "TV Special", category: "tv" },
  tvshort: { label: "TV Short", category: "tv" },
  videogame: { label: "Video Game", category: "other" },
  podcastseries: { label: "Podcast Series", category: "other" },
  podcastepisode: { label: "Podcast Episode", category: "other" },
  musicvideo: { label: "Music Video", category: "other" },
};

function typeKey(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z]/g, "");
}

export function normalizeTitleType(raw: string | null | undefined): {
  label: string;
  category: Category;
} {
  const key = typeKey(raw ?? "");
  const known = TITLE_TYPES[key];
  if (known) return known;
  if (!raw) return { label: "Unknown", category: "other" };
  if (key.startsWith("tv")) return { label: raw, category: "tv" };
  return { label: raw, category: "other" };
}

export const CATEGORY_LABELS: Record<Category, string> = {
  movie: "Movies",
  tv: "TV",
  other: "Other",
};

export function parseNumber(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/,/g, "").trim();
  if (!cleaned || cleaned === "N/A" || cleaned === "-") return null;
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function parseYear(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const match = String(raw).match(/\d{4}/);
  if (!match) return null;
  const year = Number.parseInt(match[0], 10);
  return year >= 1870 && year <= 2200 ? year : null;
}

export function splitList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part !== "N/A");
}

export function isImdbId(value: string): boolean {
  return /^tt\d{6,10}$/.test(value);
}

/** Pulls an IMDb const out of a bare id, a title URL, or a pasted line. */
export function extractImdbId(value: string): string | null {
  const match = value.match(/tt\d{6,10}/);
  return match ? match[0] : null;
}

export function titleUrl(id: string): string {
  return `https://www.imdb.com/title/${id}/`;
}

export function formatRuntime(minutes: number | null): string | null {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}
