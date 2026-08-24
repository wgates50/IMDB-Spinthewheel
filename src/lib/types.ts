/** Coarse bucket used by the "Movies / TV" filter. */
export type Category = "movie" | "tv" | "other";

/** A single entry from an IMDb watchlist, however it was imported. */
export interface WatchlistItem {
  /** IMDb const, e.g. "tt0111161". Unique key everywhere in the app. */
  id: string;
  title: string;
  year: number | null;
  /** Human-readable IMDb title type, e.g. "TV Mini Series". */
  titleType: string;
  category: Category;
  imdbRating: number | null;
  numVotes: number | null;
  /** Minutes. */
  runtime: number | null;
  genres: string[];
  directors: string[];
  url: string;
  /** ISO date the title was added to the watchlist, when the source has it. */
  addedAt: string | null;
  releaseDate: string | null;
  /**
   * Metacritic score, 0-100. Not present in IMDb exports — hydrated from OMDb
   * in the background when an OMDb key is configured.
   *   number  -> known
   *   null    -> looked up, genuinely has no Metascore
   *   undefined -> not looked up yet
   */
  metascore?: number | null;
}

export interface Filters {
  categories: Category[];
  /** Empty means "any genre". */
  genres: string[];
  /** true = title must have every selected genre; false = any of them. */
  matchAllGenres: boolean;
  minImdbRating: number;
  minMetascore: number;
  /** Keep titles whose rating/metascore is unknown rather than filtering them out. */
  includeUnrated: boolean;
  /** Exclude titles won in the last few spins. */
  skipRecentWinners: boolean;
}

export const DEFAULT_FILTERS: Filters = {
  categories: ["movie", "tv"],
  genres: [],
  matchAllGenres: false,
  minImdbRating: 0,
  minMetascore: 0,
  includeUnrated: true,
  skipRecentWinners: true,
};

export interface Person {
  name: string;
  character: string | null;
  profileUrl: string | null;
  tmdbId: number | null;
}

export interface Review {
  author: string;
  /** Author's own 0-10 score where the source provides one. */
  rating: number | null;
  content: string;
  createdAt: string | null;
  url: string | null;
  source: string;
}

export interface WatchProvider {
  name: string;
  logoUrl: string | null;
}

export interface WatchOptions {
  region: string;
  /** JustWatch deep link for the region. */
  link: string | null;
  stream: WatchProvider[];
  rent: WatchProvider[];
  buy: WatchProvider[];
  free: WatchProvider[];
}

export interface ExternalRating {
  source: string;
  value: string;
}

/** Everything the detail panel shows after the wheel lands. */
export interface TitleDetails {
  id: string;
  title: string;
  tagline: string | null;
  year: number | null;
  titleType: string;
  certificate: string | null;
  runtime: number | null;
  genres: string[];
  plot: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  imdbRating: number | null;
  imdbVotes: number | null;
  metascore: number | null;
  tmdbRating: number | null;
  ratings: ExternalRating[];
  directors: string[];
  writers: string[];
  cast: Person[];
  seasons: number | null;
  awards: string | null;
  trailerUrl: string | null;
  positiveReviews: Review[];
  negativeReviews: Review[];
  neutralReviews: Review[];
  watch: WatchOptions | null;
  /** Which upstreams actually answered, so the UI can explain any gaps. */
  sources: { omdb: boolean; tmdb: boolean };
  notes: string[];
}
