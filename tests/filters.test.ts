import { describe, expect, it } from "vitest";
import { applyFilters, buildFacets, matchesFilters } from "@/lib/filters";
import { DEFAULT_FILTERS, type Filters, type WatchlistItem } from "@/lib/types";

function item(overrides: Partial<WatchlistItem> & { id: string }): WatchlistItem {
  return {
    title: "Untitled",
    year: 2000,
    titleType: "Movie",
    category: "movie",
    imdbRating: 7,
    numVotes: 1000,
    runtime: 100,
    genres: ["Drama"],
    directors: [],
    url: `https://www.imdb.com/title/${overrides.id}/`,
    addedAt: null,
    releaseDate: null,
    ...overrides,
  };
}

const LIBRARY: WatchlistItem[] = [
  item({ id: "tt1", title: "Drama Film", genres: ["Drama"], imdbRating: 8.4, metascore: 88 }),
  item({ id: "tt2", title: "Comedy Show", category: "tv", titleType: "TV Series", genres: ["Comedy"], imdbRating: 7.2, metascore: 55 }),
  item({ id: "tt3", title: "Dark Comedy", genres: ["Drama", "Comedy"], imdbRating: 6.1, metascore: 41 }),
  item({ id: "tt4", title: "Unreleased", genres: [], imdbRating: null, metascore: null }),
  item({ id: "tt5", title: "Some Game", category: "other", titleType: "Video Game", genres: ["Action"], imdbRating: 9.1 }),
];

function withFilters(patch: Partial<Filters>): Filters {
  return { ...DEFAULT_FILTERS, ...patch };
}

describe("matchesFilters", () => {
  it("keeps only the selected categories", () => {
    const movies = applyFilters(LIBRARY, withFilters({ categories: ["movie"] }));
    expect(movies.map((entry) => entry.id)).toEqual(["tt1", "tt3", "tt4"]);
  });

  it("treats an empty category list as no category filter", () => {
    expect(applyFilters(LIBRARY, withFilters({ categories: [] }))).toHaveLength(LIBRARY.length);
  });

  it("matches any selected genre by default", () => {
    const found = applyFilters(
      LIBRARY,
      withFilters({ categories: ["movie", "tv"], genres: ["Comedy"] }),
    );
    expect(found.map((entry) => entry.id)).toEqual(["tt2", "tt3"]);
  });

  it("requires every genre when matchAllGenres is on", () => {
    const found = applyFilters(
      LIBRARY,
      withFilters({ categories: ["movie", "tv"], genres: ["Comedy", "Drama"], matchAllGenres: true }),
    );
    expect(found.map((entry) => entry.id)).toEqual(["tt3"]);
  });

  it("applies the IMDb rating floor", () => {
    const found = applyFilters(LIBRARY, withFilters({ categories: ["movie"], minImdbRating: 7 }));
    expect(found.map((entry) => entry.id)).toEqual(["tt1", "tt4"]);
  });

  it("drops unrated titles when includeUnrated is off", () => {
    const found = applyFilters(
      LIBRARY,
      withFilters({ categories: ["movie"], minImdbRating: 7, includeUnrated: false }),
    );
    expect(found.map((entry) => entry.id)).toEqual(["tt1"]);
  });

  it("applies the Metascore floor independently of the IMDb one", () => {
    const found = applyFilters(
      LIBRARY,
      withFilters({ categories: ["movie", "tv"], minMetascore: 50, includeUnrated: false }),
    );
    expect(found.map((entry) => entry.id)).toEqual(["tt1", "tt2"]);
  });

  it("keeps titles whose Metascore has not been looked up yet", () => {
    const pending = item({ id: "tt9" });
    expect(pending.metascore).toBeUndefined();
    expect(matchesFilters(pending, withFilters({ minMetascore: 90 }))).toBe(true);
    expect(matchesFilters(pending, withFilters({ minMetascore: 90, includeUnrated: false }))).toBe(
      false,
    );
  });

  it("excludes recent winners only while the toggle is on", () => {
    const recent = new Set(["tt1"]);
    expect(matchesFilters(LIBRARY[0], withFilters({ skipRecentWinners: true }), recent)).toBe(false);
    expect(matchesFilters(LIBRARY[0], withFilters({ skipRecentWinners: false }), recent)).toBe(true);
  });
});

describe("buildFacets", () => {
  it("counts genres by frequency and categories present", () => {
    const facets = buildFacets(LIBRARY);
    // Drama and Comedy both appear twice, so the alphabetical tie-break decides.
    expect(facets.genres.slice(0, 2)).toEqual([
      { name: "Comedy", count: 2 },
      { name: "Drama", count: 2 },
    ]);
    expect(facets.categories).toEqual([
      { category: "movie", count: 3 },
      { category: "tv", count: 1 },
      { category: "other", count: 1 },
    ]);
    expect(facets.maxImdbRating).toBe(9.1);
    expect(facets.hasMetascores).toBe(true);
  });

  it("reports no metascores before hydration runs", () => {
    expect(buildFacets([item({ id: "tt1" })]).hasMetascores).toBe(false);
  });
});
