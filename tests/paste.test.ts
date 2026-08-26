import { describe, expect, it } from "vitest";
import { PasteError, parsePastedWatchlist } from "@/lib/paste";

const BOOKMARKLET_JSON = JSON.stringify({
  items: [
    { id: "tt0111161", title: "The Shawshank Redemption", year: "1994", runtime: 142, rating: 9.3, type: "movie", genres: [] },
    { id: "tt0903747", title: "Breaking Bad", year: "2008", runtime: 49, rating: 9.5, type: "tvSeries", genres: ["Crime", "Drama"] },
  ],
});

const CSV = `Const,Title,Title Type,IMDb Rating,Runtime (mins),Year,Genres
tt0068646,The Godfather,movie,9.2,175,1972,"Crime, Drama"
`;

describe("parsePastedWatchlist — bookmarklet JSON", () => {
  it("reads the collected rows", () => {
    const result = parsePastedWatchlist(BOOKMARKLET_JSON);
    expect(result.format).toBe("json");
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      id: "tt0111161",
      title: "The Shawshank Redemption",
      year: 1994,
      runtime: 142,
      imdbRating: 9.3,
      category: "movie",
    });
    expect(result.items[1]).toMatchObject({ category: "tv", titleType: "TV Series" });
  });

  it("accepts a bare array as well as an items wrapper", () => {
    const bare = JSON.stringify([{ id: "tt0111161", title: "X" }]);
    expect(parsePastedWatchlist(bare).items).toHaveLength(1);
  });

  it("keeps genres when the page had them, and flags partial when none did", () => {
    expect(parsePastedWatchlist(BOOKMARKLET_JSON).partial).toBe(false);
    const noGenres = JSON.stringify({ items: [{ id: "tt0111161", title: "X" }] });
    expect(parsePastedWatchlist(noGenres).partial).toBe(true);
  });

  it("drops rows with no id or no title, and de-duplicates", () => {
    const messy = JSON.stringify({
      items: [
        { id: "tt0111161", title: "Keep" },
        { id: "tt0111161", title: "Duplicate" },
        { id: "tt0000000x", title: "Bad id" },
        { id: "tt0068646", title: "" },
      ],
    });
    const items = parsePastedWatchlist(messy).items;
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Keep");
  });

  it("rejects unreadable JSON", () => {
    expect(() => parsePastedWatchlist("{not json")).toThrow(PasteError);
  });

  it("rejects JSON with no titles in it", () => {
    expect(() => parsePastedWatchlist('{"items":[]}')).toThrow(PasteError);
  });
});

describe("parsePastedWatchlist — CSV text", () => {
  it("reads pasted export contents without a file upload", () => {
    const result = parsePastedWatchlist(CSV);
    expect(result.format).toBe("csv");
    expect(result.partial).toBe(false);
    expect(result.items[0]).toMatchObject({ id: "tt0068646", genres: ["Crime", "Drama"] });
  });
});

describe("parsePastedWatchlist — freeform links", () => {
  it("pulls titles out of pasted links", () => {
    const text = `
https://www.imdb.com/title/tt0111161/ The Shawshank Redemption
https://www.imdb.com/title/tt0068646/?ref_=x
tt0903747 Breaking Bad (2008)
`;
    const result = parsePastedWatchlist(text);
    expect(result.format).toBe("links");
    expect(result.partial).toBe(true);
    expect(result.items.map((item) => item.id)).toEqual(["tt0111161", "tt0068646", "tt0903747"]);
    expect(result.items[0].title).toBe("The Shawshank Redemption");
    expect(result.items[2].year).toBe(2008);
  });

  it("falls back to the id when a line has no title text", () => {
    expect(parsePastedWatchlist("https://www.imdb.com/title/tt0068646/").items[0].title).toBe(
      "tt0068646",
    );
  });

  it("strips list numbering from the title", () => {
    expect(parsePastedWatchlist("1. tt0111161 Shawshank").items[0].title).toBe("Shawshank");
  });

  it("rejects text with no IMDb ids at all", () => {
    expect(() => parsePastedWatchlist("just some words")).toThrow(PasteError);
  });

  it("rejects an empty paste", () => {
    expect(() => parsePastedWatchlist("   ")).toThrow(PasteError);
  });
});
