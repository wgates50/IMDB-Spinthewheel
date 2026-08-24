import type { Category, Filters, WatchlistItem } from "./types";

export interface Facets {
  genres: { name: string; count: number }[];
  categories: { category: Category; count: number }[];
  maxImdbRating: number;
  /** True when at least one item has a Metascore, i.e. hydration has produced something. */
  hasMetascores: boolean;
}

export function buildFacets(items: WatchlistItem[]): Facets {
  const genreCounts = new Map<string, number>();
  const categoryCounts = new Map<Category, number>();
  let maxImdbRating = 0;
  let hasMetascores = false;

  for (const item of items) {
    for (const genre of item.genres) {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    }
    categoryCounts.set(item.category, (categoryCounts.get(item.category) ?? 0) + 1);
    if (item.imdbRating && item.imdbRating > maxImdbRating) maxImdbRating = item.imdbRating;
    if (typeof item.metascore === "number") hasMetascores = true;
  }

  return {
    genres: [...genreCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    categories: (["movie", "tv", "other"] as Category[])
      .map((category) => ({ category, count: categoryCounts.get(category) ?? 0 }))
      .filter((entry) => entry.count > 0),
    maxImdbRating,
    hasMetascores,
  };
}

/**
 * A title passes when it clears every active filter. Unknown ratings are kept
 * or dropped by `includeUnrated` rather than silently counting as zero — an
 * unrated title is missing data, not a bad title.
 */
export function matchesFilters(
  item: WatchlistItem,
  filters: Filters,
  excludedIds: ReadonlySet<string> = new Set(),
): boolean {
  if (filters.categories.length && !filters.categories.includes(item.category)) return false;

  if (filters.genres.length) {
    const has = (genre: string) => item.genres.includes(genre);
    const ok = filters.matchAllGenres ? filters.genres.every(has) : filters.genres.some(has);
    if (!ok) return false;
  }

  if (filters.minImdbRating > 0) {
    if (item.imdbRating == null) {
      if (!filters.includeUnrated) return false;
    } else if (item.imdbRating < filters.minImdbRating) {
      return false;
    }
  }

  if (filters.minMetascore > 0) {
    if (item.metascore == null) {
      if (!filters.includeUnrated) return false;
    } else if (item.metascore < filters.minMetascore) {
      return false;
    }
  }

  if (filters.skipRecentWinners && excludedIds.has(item.id)) return false;

  return true;
}

export function applyFilters(
  items: WatchlistItem[],
  filters: Filters,
  excludedIds: ReadonlySet<string> = new Set(),
): WatchlistItem[] {
  return items.filter((item) => matchesFilters(item, filters, excludedIds));
}
