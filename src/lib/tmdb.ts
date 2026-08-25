import { TtlCache } from "./cache";
import { fetchJson } from "./http";

const IMAGE_BASE = "https://image.tmdb.org/t/p";

export interface TmdbCredit {
  id?: number;
  name?: string;
  character?: string;
  job?: string;
  profile_path?: string | null;
  roles?: { character?: string }[];
  order?: number;
  total_episode_count?: number;
}

export interface TmdbReview {
  id?: string;
  author?: string;
  content?: string;
  created_at?: string;
  url?: string;
  author_details?: { rating?: number | null; username?: string };
}

export interface TmdbProvider {
  provider_name?: string;
  logo_path?: string | null;
  display_priority?: number;
}

export interface TmdbProviderRegion {
  link?: string;
  flatrate?: TmdbProvider[];
  rent?: TmdbProvider[];
  buy?: TmdbProvider[];
  free?: TmdbProvider[];
  ads?: TmdbProvider[];
}

export interface TmdbTitle {
  id?: number;
  title?: string;
  name?: string;
  tagline?: string | null;
  overview?: string | null;
  release_date?: string;
  first_air_date?: string;
  runtime?: number | null;
  episode_run_time?: number[];
  number_of_seasons?: number;
  vote_average?: number;
  vote_count?: number;
  poster_path?: string | null;
  backdrop_path?: string | null;
  genres?: { name?: string }[];
  credits?: { cast?: TmdbCredit[]; crew?: TmdbCredit[] };
  aggregate_credits?: { cast?: TmdbCredit[]; crew?: TmdbCredit[] };
  created_by?: TmdbCredit[];
  reviews?: { results?: TmdbReview[] };
  videos?: { results?: { key?: string; site?: string; type?: string; official?: boolean }[] };
  "watch/providers"?: { results?: Record<string, TmdbProviderRegion> };
  content_ratings?: { results?: { iso_3166_1?: string; rating?: string }[] };
  release_dates?: {
    results?: {
      iso_3166_1?: string;
      release_dates?: { certification?: string }[];
    }[];
  };
}

export type TmdbMedia = "movie" | "tv";

export interface TmdbLookup {
  media: TmdbMedia;
  detail: TmdbTitle;
}

const cache = new TtlCache<TmdbLookup | null>(1000 * 60 * 60 * 6, 500);

interface TmdbAuth {
  bearer: string | null;
  apiKey: string | null;
}

function auth(): TmdbAuth {
  return {
    bearer: process.env.TMDB_ACCESS_TOKEN?.trim() || null,
    apiKey: process.env.TMDB_API_KEY?.trim() || null,
  };
}

export function hasTmdb(): boolean {
  const { bearer, apiKey } = auth();
  return Boolean(bearer || apiKey);
}

async function tmdbGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const { bearer, apiKey } = auth();
  const query = new URLSearchParams(params);
  // v3 key and v4 bearer are both accepted; prefer the bearer when both exist.
  if (!bearer && apiKey) query.set("api_key", apiKey);
  const url = `https://api.themoviedb.org/3${path}?${query.toString()}`;
  return fetchJson<T>(url, bearer ? { headers: { authorization: `Bearer ${bearer}` } } : {});
}

export function imageUrl(path: string | null | undefined, size: string): string | null {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}

/** Resolves an IMDb const to its TMDB record, with credits, reviews and providers. */
export async function fetchTmdb(imdbId: string): Promise<TmdbLookup | null> {
  if (!hasTmdb()) return null;

  const cached = cache.get(imdbId);
  if (cached !== undefined) return cached;

  try {
    const found = await tmdbGet<{ movie_results?: { id?: number }[]; tv_results?: { id?: number }[] }>(
      `/find/${encodeURIComponent(imdbId)}`,
      { external_source: "imdb_id" },
    );

    const movieId = found.movie_results?.[0]?.id;
    const tvId = found.tv_results?.[0]?.id;
    const media: TmdbMedia | null = movieId ? "movie" : tvId ? "tv" : null;
    const id = movieId ?? tvId;
    if (!media || !id) {
      cache.set(imdbId, null);
      return null;
    }

    const append =
      media === "movie"
        ? "credits,reviews,videos,watch/providers,release_dates"
        : "credits,aggregate_credits,reviews,videos,watch/providers,content_ratings";

    const detail = await tmdbGet<TmdbTitle>(`/${media}/${id}`, {
      append_to_response: append,
      language: "en-US",
    });

    const lookup: TmdbLookup = { media, detail };
    cache.set(imdbId, lookup);
    return lookup;
  } catch {
    return null;
  }
}

export function trailerUrl(detail: TmdbTitle): string | null {
  const videos = detail.videos?.results ?? [];
  const pick =
    videos.find((v) => v.site === "YouTube" && v.type === "Trailer" && v.official) ??
    videos.find((v) => v.site === "YouTube" && v.type === "Trailer") ??
    videos.find((v) => v.site === "YouTube" && v.type === "Teaser");
  return pick?.key ? `https://www.youtube.com/watch?v=${pick.key}` : null;
}

export function certificationOf(detail: TmdbTitle, region: string): string | null {
  const tv = detail.content_ratings?.results ?? [];
  const tvMatch = tv.find((entry) => entry.iso_3166_1 === region) ?? tv.find((e) => e.iso_3166_1 === "US");
  if (tvMatch?.rating) return tvMatch.rating;

  const movie = detail.release_dates?.results ?? [];
  const movieMatch =
    movie.find((entry) => entry.iso_3166_1 === region) ?? movie.find((e) => e.iso_3166_1 === "US");
  const certification = movieMatch?.release_dates?.find((entry) => entry.certification)?.certification;
  return certification || null;
}
