import { fetchOmdb, metascoreOf, omdbList, omdbText, omdbKey } from "./omdb";
import { formatRuntime, parseNumber, parseYear, titleUrl } from "./normalize";
import {
  certificationOf,
  fetchTmdb,
  hasTmdb,
  imageUrl,
  trailerUrl,
  type TmdbCredit,
  type TmdbLookup,
  type TmdbReview,
  type TmdbProvider,
} from "./tmdb";
import type { Person, Review, TitleDetails, WatchOptions, WatchProvider } from "./types";

const LIKED_AT = 7;
const DISLIKED_AT = 5;

function toPerson(credit: TmdbCredit): Person {
  return {
    name: credit.name ?? "Unknown",
    character: credit.character ?? credit.roles?.[0]?.character ?? null,
    profileUrl: imageUrl(credit.profile_path, "w185"),
    tmdbId: credit.id ?? null,
  };
}

function castOf(lookup: TmdbLookup | null): Person[] {
  if (!lookup) return [];
  const { detail, media } = lookup;
  const source =
    media === "tv"
      ? (detail.aggregate_credits?.cast?.length ? detail.aggregate_credits.cast : detail.credits?.cast)
      : detail.credits?.cast;
  return (source ?? [])
    .slice()
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .slice(0, 14)
    .map(toPerson);
}

function crewNames(lookup: TmdbLookup | null, jobs: string[]): string[] {
  if (!lookup) return [];
  const crew = lookup.detail.credits?.crew ?? lookup.detail.aggregate_credits?.crew ?? [];
  const names = crew
    .filter((member) => member.job && jobs.includes(member.job))
    .map((member) => member.name)
    .filter((name): name is string => Boolean(name));
  return [...new Set(names)];
}

function toReview(review: TmdbReview): Review {
  return {
    author: review.author_details?.username || review.author || "Anonymous",
    rating: typeof review.author_details?.rating === "number" ? review.author_details.rating : null,
    content: (review.content ?? "").trim(),
    createdAt: review.created_at ?? null,
    url: review.url ?? null,
    source: "TMDB",
  };
}

/**
 * Splits reviews into what people liked and what they didn't, using the
 * reviewer's own score. Reviews without a score stay in their own bucket
 * rather than being guessed at.
 */
function splitReviews(lookup: TmdbLookup | null): {
  positive: Review[];
  negative: Review[];
  neutral: Review[];
} {
  const all = (lookup?.detail.reviews?.results ?? [])
    .map(toReview)
    .filter((review) => review.content.length > 0);

  const byLength = (a: Review, b: Review) => b.content.length - a.content.length;

  return {
    positive: all.filter((r) => r.rating !== null && r.rating >= LIKED_AT).sort(byLength).slice(0, 4),
    negative: all.filter((r) => r.rating !== null && r.rating <= DISLIKED_AT).sort(byLength).slice(0, 4),
    neutral: all.filter((r) => r.rating === null || (r.rating > DISLIKED_AT && r.rating < LIKED_AT))
      .sort(byLength)
      .slice(0, 3),
  };
}

function providers(list: TmdbProvider[] | undefined): WatchProvider[] {
  return (list ?? [])
    .slice()
    .sort((a, b) => (a.display_priority ?? 999) - (b.display_priority ?? 999))
    .map((entry) => ({
      name: entry.provider_name ?? "Unknown",
      logoUrl: imageUrl(entry.logo_path, "w92"),
    }));
}

function watchOptionsOf(lookup: TmdbLookup | null, region: string): WatchOptions | null {
  const regions = lookup?.detail["watch/providers"]?.results;
  if (!regions) return null;
  const entry = regions[region];
  if (!entry) return { region, link: null, stream: [], rent: [], buy: [], free: [] };
  return {
    region,
    link: entry.link ?? null,
    stream: providers(entry.flatrate),
    rent: providers(entry.rent),
    buy: providers(entry.buy),
    free: [...providers(entry.free), ...providers(entry.ads)],
  };
}

export interface DetailsOptions {
  region: string;
  /** Fallbacks from the watchlist row, used wherever the APIs are silent. */
  fallback?: {
    title?: string;
    year?: number | null;
    titleType?: string;
    genres?: string[];
    imdbRating?: number | null;
    runtime?: number | null;
  };
}

/** Merges OMDb and TMDB into the single shape the result panel renders. */
export async function buildTitleDetails(
  imdbId: string,
  options: DetailsOptions,
): Promise<TitleDetails> {
  const region = options.region.toUpperCase();
  const fallback = options.fallback ?? {};

  const [omdb, tmdb] = await Promise.all([fetchOmdb(imdbId), fetchTmdb(imdbId)]);
  const detail = tmdb?.detail;
  const notes: string[] = [];

  if (!omdbKey()) {
    notes.push("Add an OMDB_API_KEY to show Metascore, certificate and awards.");
  } else if (!omdb) {
    notes.push("OMDb had nothing for this title.");
  }
  if (!hasTmdb()) {
    notes.push("Add a TMDB key to show cast, reviews, trailers and where to watch.");
  } else if (!tmdb) {
    notes.push("TMDB had no match for this IMDb ID, so cast and streaming are unavailable.");
  }

  const tmdbRuntime =
    detail?.runtime ?? (detail?.episode_run_time?.length ? detail.episode_run_time[0] : null);

  const genres = detail?.genres?.map((genre) => genre.name).filter((n): n is string => Boolean(n));
  const reviews = splitReviews(tmdb);

  const directors = crewNames(tmdb, ["Director"]);
  const creators = (detail?.created_by ?? [])
    .map((person) => person.name)
    .filter((name): name is string => Boolean(name));

  return {
    id: imdbId,
    title: omdbText(omdb?.Title) ?? detail?.title ?? detail?.name ?? fallback.title ?? imdbId,
    tagline: detail?.tagline?.trim() || null,
    year:
      parseYear(omdb?.Year) ??
      parseYear(detail?.release_date ?? detail?.first_air_date) ??
      fallback.year ??
      null,
    titleType:
      fallback.titleType ??
      (tmdb?.media === "tv" ? "TV Series" : omdbText(omdb?.Type) ?? "Movie"),
    certificate: omdbText(omdb?.Rated) ?? (detail ? certificationOf(detail, region) : null),
    runtime:
      parseNumber((omdb?.Runtime ?? "").replace(/\s*min\s*/i, "")) ??
      tmdbRuntime ??
      fallback.runtime ??
      null,
    genres: omdbList(omdb?.Genre).length
      ? omdbList(omdb?.Genre)
      : genres?.length
        ? genres
        : (fallback.genres ?? []),
    plot: omdbText(omdb?.Plot) ?? detail?.overview?.trim() ?? null,
    posterUrl:
      imageUrl(detail?.poster_path, "w500") ??
      (omdbText(omdb?.Poster) ? (omdb?.Poster as string) : null),
    backdropUrl: imageUrl(detail?.backdrop_path, "w1280"),
    imdbRating: parseNumber(omdb?.imdbRating ?? null) ?? fallback.imdbRating ?? null,
    imdbVotes: parseNumber(omdb?.imdbVotes ?? null),
    metascore: metascoreOf(omdb),
    tmdbRating: typeof detail?.vote_average === "number" && detail.vote_average > 0
      ? Math.round(detail.vote_average * 10) / 10
      : null,
    ratings: (omdb?.Ratings ?? []).map((rating) => ({
      source: rating.Source,
      value: rating.Value,
    })),
    directors: directors.length ? directors : creators.length ? creators : omdbList(omdb?.Director),
    writers: crewNames(tmdb, ["Screenplay", "Writer", "Story"]).slice(0, 4).length
      ? crewNames(tmdb, ["Screenplay", "Writer", "Story"]).slice(0, 4)
      : omdbList(omdb?.Writer).slice(0, 4),
    cast: castOf(tmdb).length
      ? castOf(tmdb)
      : omdbList(omdb?.Actors).map((name) => ({
          name,
          character: null,
          profileUrl: null,
          tmdbId: null,
        })),
    seasons: parseNumber(omdb?.totalSeasons ?? null) ?? detail?.number_of_seasons ?? null,
    awards: omdbText(omdb?.Awards),
    trailerUrl: detail ? trailerUrl(detail) : null,
    positiveReviews: reviews.positive,
    negativeReviews: reviews.negative,
    neutralReviews: reviews.neutral,
    watch: watchOptionsOf(tmdb, region),
    sources: { omdb: Boolean(omdb), tmdb: Boolean(tmdb) },
    notes,
  };
}

export { formatRuntime, titleUrl };
