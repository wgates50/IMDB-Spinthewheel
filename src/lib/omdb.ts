import { TtlCache } from "./cache";
import { fetchJson } from "./http";
import { parseNumber } from "./normalize";

export interface OmdbTitle {
  Title?: string;
  Year?: string;
  Rated?: string;
  Runtime?: string;
  Genre?: string;
  Director?: string;
  Writer?: string;
  Actors?: string;
  Plot?: string;
  Awards?: string;
  Poster?: string;
  Metascore?: string;
  imdbRating?: string;
  imdbVotes?: string;
  Type?: string;
  totalSeasons?: string;
  Ratings?: { Source: string; Value: string }[];
  Response?: string;
  Error?: string;
}

const cache = new TtlCache<OmdbTitle | null>(1000 * 60 * 60 * 12, 1000);

export function omdbKey(): string | null {
  return process.env.OMDB_API_KEY?.trim() || null;
}

export async function fetchOmdb(imdbId: string): Promise<OmdbTitle | null> {
  const key = omdbKey();
  if (!key) return null;

  const cached = cache.get(imdbId);
  if (cached !== undefined) return cached;

  const url = `https://www.omdbapi.com/?apikey=${encodeURIComponent(key)}&i=${encodeURIComponent(
    imdbId,
  )}&plot=full`;

  let data: OmdbTitle;
  try {
    data = await fetchJson<OmdbTitle>(url);
  } catch {
    // Don't cache transport failures — the next spin should retry.
    return null;
  }

  const value = data.Response === "False" ? null : data;
  cache.set(imdbId, value);
  return value;
}

/** Metascore as 0-100, or null when the title genuinely has none. */
export function metascoreOf(data: OmdbTitle | null): number | null {
  const value = parseNumber(data?.Metascore ?? null);
  return value === null || value < 0 || value > 100 ? null : value;
}

export function omdbList(raw: string | undefined): string[] {
  if (!raw || raw === "N/A") return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function omdbText(raw: string | undefined): string | null {
  return !raw || raw === "N/A" ? null : raw;
}
