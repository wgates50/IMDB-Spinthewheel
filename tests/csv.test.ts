import { describe, expect, it } from "vitest";
import { CsvImportError, parseCsv, parseImdbCsv } from "@/lib/csv";

const MODERN_EXPORT = `Position,Const,Created,Modified,Description,Title,Original Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors
1,tt0111161,2024-01-05,2024-01-05,,The Shawshank Redemption,The Shawshank Redemption,https://www.imdb.com/title/tt0111161/,movie,9.3,142,1994,Drama,2900000,1994-10-14,Frank Darabont
2,tt0903747,2024-02-11,2024-02-11,,Breaking Bad,Breaking Bad,https://www.imdb.com/title/tt0903747/,tvSeries,9.5,49,2008,"Crime, Drama, Thriller",2100000,2008-01-20,
3,tt7366338,2024-02-12,2024-02-12,,Chernobyl,Chernobyl,https://www.imdb.com/title/tt7366338/,tvMiniSeries,9.3,330,2019,"Drama, History, Thriller",900000,2019-05-06,
`;

const LEGACY_EXPORT = `"Const","Created","Modified","Description","Title","URL","Title Type","IMDb Rating","Runtime (mins)","Year","Genres","Num Votes","Release Date","Directors"
"tt0068646","Mon Jan 1 00:00:00 2018","Mon Jan 1 00:00:00 2018","","The Godfather","https://www.imdb.com/title/tt0068646/","Movie","9.2","175","1972","Crime, Drama","2050000","1972-03-24","Francis Ford Coppola"
`;

describe("parseCsv", () => {
  it("keeps commas that live inside quoted fields", () => {
    const rows = parseCsv('a,b\n"one, two",three\n');
    expect(rows[1]).toEqual(["one, two", "three"]);
  });

  it("unescapes doubled quotes", () => {
    const rows = parseCsv('title\n"He said ""hi"""\n');
    expect(rows[1][0]).toBe('He said "hi"');
  });

  it("keeps newlines that live inside quoted fields", () => {
    const rows = parseCsv('a,b\n"line one\nline two",x\n');
    expect(rows).toHaveLength(2);
    expect(rows[1][0]).toBe("line one\nline two");
  });

  it("strips a UTF-8 BOM", () => {
    const rows = parseCsv("﻿Const,Title\ntt0111161,X\n");
    expect(rows[0][0]).toBe("Const");
  });

  it("handles CRLF line endings", () => {
    const rows = parseCsv("a,b\r\n1,2\r\n");
    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("parseImdbCsv", () => {
  it("reads the current export format", () => {
    const items = parseImdbCsv(MODERN_EXPORT);
    expect(items).toHaveLength(3);

    const [shawshank, breakingBad, chernobyl] = items;
    expect(shawshank).toMatchObject({
      id: "tt0111161",
      title: "The Shawshank Redemption",
      year: 1994,
      titleType: "Movie",
      category: "movie",
      imdbRating: 9.3,
      runtime: 142,
      genres: ["Drama"],
      directors: ["Frank Darabont"],
    });
    expect(breakingBad).toMatchObject({ category: "tv", titleType: "TV Series" });
    expect(breakingBad.genres).toEqual(["Crime", "Drama", "Thriller"]);
    expect(chernobyl.titleType).toBe("TV Mini Series");
  });

  it("reads the older spaced-label export format", () => {
    const [godfather] = parseImdbCsv(LEGACY_EXPORT);
    expect(godfather).toMatchObject({
      id: "tt0068646",
      titleType: "Movie",
      category: "movie",
      numVotes: 2050000,
    });
  });

  it("drops duplicate consts", () => {
    const doubled = MODERN_EXPORT + MODERN_EXPORT.split("\n")[1] + "\n";
    expect(parseImdbCsv(doubled)).toHaveLength(3);
  });

  it("rejects a file that is not an IMDb export", () => {
    expect(() => parseImdbCsv("name,email\nAda,ada@example.com\n")).toThrow(CsvImportError);
  });

  it("rejects an empty file", () => {
    expect(() => parseImdbCsv("")).toThrow(CsvImportError);
  });
});
