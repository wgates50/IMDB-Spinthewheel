import { describe, expect, it } from "vitest";
import { itemsFromEmbeddedJson, itemsFromLinkedData, parseListRef } from "@/lib/imdbList";

/**
 * A cut-down version of the JSON IMDb embeds in a list page. The real payload
 * is far larger and its shape moves around, which is exactly why the importer
 * walks the tree instead of following a fixed path — these fixtures bury the
 * title nodes at two different depths on purpose.
 */
const EMBEDDED = `
<html><body>
<script id="__NEXT_DATA__" type="application/json">
{"props":{"pageProps":{"mainColumnData":{"list":{"titleListItemSearch":{"edges":[
  {"listItem":{
    "id":"tt0111161",
    "titleText":{"text":"The Shawshank Redemption"},
    "releaseYear":{"year":1994},
    "titleType":{"id":"movie","text":"Movie"},
    "ratingsSummary":{"aggregateRating":9.3,"voteCount":2900000},
    "runtime":{"seconds":8520},
    "titleGenres":{"genres":[{"genre":{"text":"Drama"}}]},
    "releaseDate":{"year":1994,"month":10,"day":14}
  }},
  {"listItem":{
    "id":"tt0903747",
    "titleText":{"text":"Breaking Bad"},
    "releaseYear":{"year":2008},
    "titleType":{"id":"tvSeries","text":"TV Series"},
    "ratingsSummary":{"aggregateRating":9.5,"voteCount":2100000},
    "runtime":{"seconds":2940},
    "titleGenres":{"genres":[{"genre":{"text":"Crime"}},{"genre":{"text":"Drama"}}]}
  }}
]}}}}}}
</script>
<script type="application/json">{"somethingElse":{"nested":{"deeper":{
  "id":"tt7366338","titleText":{"text":"Chernobyl"},"titleType":{"id":"tvMiniSeries"}
}}}}</script>
<script type="application/json">not valid json at all</script>
</body></html>`;

const LINKED_DATA = `
<html><body>
<script type="application/ld+json">
{"@type":"ItemList","itemListElement":[
  {"@type":"ListItem","item":{"@type":"Movie","url":"https://www.imdb.com/title/tt0068646/","name":"The Godfather"}},
  {"@type":"ListItem","item":{"@type":"TVSeries","url":"https://www.imdb.com/title/tt0306414/","name":"The Wire"}}
]}
</script>
</body></html>`;

describe("parseListRef", () => {
  it("accepts bare ids", () => {
    expect(parseListRef("ur12345678")).toEqual({ kind: "user", id: "ur12345678" });
    expect(parseListRef("ls123456789")).toEqual({ kind: "list", id: "ls123456789" });
  });

  it("accepts full urls", () => {
    expect(parseListRef("https://www.imdb.com/user/ur12345678/watchlist/")).toEqual({
      kind: "user",
      id: "ur12345678",
    });
    expect(parseListRef("https://m.imdb.com/list/ls987654321/?ref_=x")).toEqual({
      kind: "list",
      id: "ls987654321",
    });
  });

  it("prefers a list id when a url carries both", () => {
    expect(parseListRef("imdb.com/user/ur111111/lists/ls222222")).toEqual({
      kind: "list",
      id: "ls222222",
    });
  });

  it("rejects anything without an id", () => {
    expect(parseListRef("https://www.imdb.com/chart/top/")).toBeNull();
  });
});

describe("itemsFromEmbeddedJson", () => {
  it("finds title nodes wherever they sit in the payload", () => {
    const items = itemsFromEmbeddedJson(EMBEDDED);
    expect(items.map((item) => item.id).sort()).toEqual([
      "tt0111161",
      "tt0903747",
      "tt7366338",
    ]);
  });

  it("maps the fields the filters depend on", () => {
    const items = itemsFromEmbeddedJson(EMBEDDED);
    const shawshank = items.find((item) => item.id === "tt0111161");
    expect(shawshank).toMatchObject({
      title: "The Shawshank Redemption",
      year: 1994,
      category: "movie",
      titleType: "Movie",
      imdbRating: 9.3,
      numVotes: 2900000,
      runtime: 142,
      genres: ["Drama"],
      releaseDate: "1994-10-14",
    });

    const breakingBad = items.find((item) => item.id === "tt0903747");
    expect(breakingBad).toMatchObject({ category: "tv", titleType: "TV Series", runtime: 49 });
    expect(breakingBad?.genres).toEqual(["Crime", "Drama"]);
  });

  it("survives script blocks that are not JSON", () => {
    expect(() => itemsFromEmbeddedJson(EMBEDDED)).not.toThrow();
  });

  it("returns nothing for a page with no title nodes", () => {
    expect(itemsFromEmbeddedJson("<html><body>Sorry</body></html>")).toEqual([]);
  });
});

describe("itemsFromLinkedData", () => {
  it("reads titles out of an ItemList", () => {
    const items = itemsFromLinkedData(LINKED_DATA);
    expect(items.map((item) => item.title)).toEqual(["The Godfather", "The Wire"]);
    expect(items[1].category).toBe("tv");
  });
});
