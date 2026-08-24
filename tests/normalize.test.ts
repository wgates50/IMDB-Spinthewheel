import { describe, expect, it } from "vitest";
import {
  extractImdbId,
  formatRuntime,
  isImdbId,
  normalizeTitleType,
  parseNumber,
  parseYear,
  splitList,
} from "@/lib/normalize";

describe("normalizeTitleType", () => {
  it("maps both export spellings to the same label", () => {
    expect(normalizeTitleType("tvMiniSeries")).toEqual({
      label: "TV Mini Series",
      category: "tv",
    });
    expect(normalizeTitleType("TV Mini Series")).toEqual({
      label: "TV Mini Series",
      category: "tv",
    });
  });

  it("files video games away from movies and TV", () => {
    expect(normalizeTitleType("videoGame").category).toBe("other");
  });

  it("guesses TV for unknown tv-prefixed types", () => {
    expect(normalizeTitleType("tvSomethingNew").category).toBe("tv");
  });

  it("falls back to Unknown for missing types", () => {
    expect(normalizeTitleType(null)).toEqual({ label: "Unknown", category: "other" });
  });
});

describe("parseNumber", () => {
  it("strips thousands separators", () => {
    expect(parseNumber("2,900,000")).toBe(2900000);
  });

  it("treats IMDb's N/A as missing", () => {
    expect(parseNumber("N/A")).toBeNull();
    expect(parseNumber("")).toBeNull();
    expect(parseNumber(null)).toBeNull();
  });
});

describe("parseYear", () => {
  it("pulls a year out of a date", () => {
    expect(parseYear("2019-05-06")).toBe(2019);
  });

  it("rejects implausible years", () => {
    expect(parseYear("0042")).toBeNull();
  });
});

describe("splitList", () => {
  it("splits and trims", () => {
    expect(splitList("Crime, Drama, Thriller")).toEqual(["Crime", "Drama", "Thriller"]);
  });

  it("returns nothing for N/A", () => {
    expect(splitList("N/A")).toEqual([]);
  });
});

describe("imdb ids", () => {
  it("recognises well-formed consts", () => {
    expect(isImdbId("tt0111161")).toBe(true);
    expect(isImdbId("nm0000209")).toBe(false);
    expect(isImdbId("tt12")).toBe(false);
  });

  it("extracts a const from a url", () => {
    expect(extractImdbId("https://www.imdb.com/title/tt0111161/?ref_=wl")).toBe("tt0111161");
    expect(extractImdbId("nothing here")).toBeNull();
  });
});

describe("formatRuntime", () => {
  it("formats hours and minutes", () => {
    expect(formatRuntime(142)).toBe("2h 22m");
    expect(formatRuntime(120)).toBe("2h");
    expect(formatRuntime(49)).toBe("49m");
    expect(formatRuntime(null)).toBeNull();
    expect(formatRuntime(0)).toBeNull();
  });
});
