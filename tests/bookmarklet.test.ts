// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BOOKMARKLET_HREF, BOOKMARKLET_SOURCE } from "@/lib/bookmarklet";

/**
 * A page shaped like IMDb's watchlist. The detail that matters is that IMDb
 * runs its fields together in textContent ("Redemption1994", "2008TV Series"),
 * which is exactly what broke the first version of this script.
 */
const WATCHLIST = `
<ul>
  <li class="ipc-metadata-list-summary-item">
    <a class="ipc-title-link-wrapper" href="/title/tt0111161/?ref_=wl_t_1"><h3>1. The Shawshank Redemption</h3></a>
    <span>1994</span><span>2h 22m</span>
    <span class="ipc-rating-star--rating">9.3</span>
  </li>
  <li class="ipc-metadata-list-summary-item">
    <a href="/title/tt0111161/?ref_=poster"><img src="p.jpg"></a>
    <a class="ipc-title-link-wrapper" href="/title/tt0903747/?ref_=wl_t_2"><h3>2. Breaking Bad</h3></a>
    <span>2008</span><span>TV Series</span><span>49m</span>
    <span class="ipc-rating-star--rating">9.5</span>
  </li>
  <li class="ipc-metadata-list-summary-item">
    <a class="ipc-title-link-wrapper" href="/title/tt7366338/?ref_=wl_t_3"><h3>3. Chernobyl</h3></a>
    <span>2019</span><span>TV Mini Series</span><span>5h 30m</span>
    <span class="ipc-rating-star--rating">9.3</span>
  </li>
  <li><a href="/name/nm0000209/">A Person</a></li>
</ul>
<button id="more">50 more</button>
`;

interface Collected {
  id: string;
  title: string;
  year: string | null;
  runtime: number | null;
  rating: number | null;
  type: string;
}

let copied = "";
let alerted: string[] = [];

async function runBookmarklet(): Promise<Collected[]> {
  await new Function(`return (async () => { ${BOOKMARKLET_SOURCE} })()`)();
  // The script's scroll loop settles once no new rows appear.
  await new Promise((resolve) => setTimeout(resolve, 2500));
  return JSON.parse(copied).items as Collected[];
}

beforeEach(() => {
  copied = "";
  alerted = [];
  document.body.innerHTML = WATCHLIST;

  // A late-loading row, the way the watchlist pages in as you scroll.
  document.getElementById("more")?.addEventListener("click", function (this: HTMLElement) {
    const li = document.createElement("li");
    li.innerHTML =
      '<a class="ipc-title-link-wrapper" href="/title/tt0068646/?ref_=wl_t_4"><h3>4. The Godfather</h3></a>' +
      "<span>1972</span><span>2h 55m</span>" +
      '<span class="ipc-rating-star--rating">9.2</span>';
    document.querySelector("ul")?.appendChild(li);
    this.remove();
  });

  Object.defineProperty(window, "location", {
    value: { hostname: "www.imdb.com" },
    writable: true,
  });
  Object.defineProperty(navigator, "clipboard", {
    value: {
      writeText: (text: string) => {
        copied = text;
        return Promise.resolve();
      },
    },
    configurable: true,
  });
  window.alert = (message?: unknown) => void alerted.push(String(message));
  window.scrollTo = vi.fn();
});

describe("the IMDb bookmarklet", () => {
  it("collects every title, including rows loaded by the more button", async () => {
    const items = await runBookmarklet();
    expect(items.map((item) => item.id)).toEqual([
      "tt0111161",
      "tt0903747",
      "tt7366338",
      "tt0068646",
    ]);
    expect(alerted[0]).toContain("4 titles copied");
  }, 15_000);

  it("reads runtimes correctly even though IMDb runs the fields together", async () => {
    // "…Redemption1994 2h 22m…" once read naively yields "19942h" — a runtime
    // of 1,196,542 minutes. The fields have to be separated first.
    const items = await runBookmarklet();
    expect(items.map((item) => item.runtime)).toEqual([142, 49, 330, 175]);
  }, 15_000);

  it("reads the year rather than digits from an adjacent field", async () => {
    const items = await runBookmarklet();
    expect(items.map((item) => item.year)).toEqual(["1994", "2008", "2019", "1972"]);
  }, 15_000);

  it("tells series and mini-series apart from films", async () => {
    const items = await runBookmarklet();
    expect(items.map((item) => item.type)).toEqual([
      "movie",
      "tvSeries",
      "tvMiniSeries",
      "movie",
    ]);
  }, 15_000);

  it("takes the ratings and ignores links that are not titles", async () => {
    const items = await runBookmarklet();
    expect(items.map((item) => item.rating)).toEqual([9.3, 9.5, 9.3, 9.2]);
    expect(items.some((item) => item.id.startsWith("nm"))).toBe(false);
  }, 15_000);

  it("keeps the text-bearing link when a poster link points at the same title", async () => {
    const items = await runBookmarklet();
    const shawshank = items.filter((item) => item.id === "tt0111161");
    expect(shawshank).toHaveLength(1);
    expect(shawshank[0].title).toBe("The Shawshank Redemption");
  }, 15_000);

  it("refuses to run anywhere but imdb.com", async () => {
    Object.defineProperty(window, "location", {
      value: { hostname: "example.com" },
      writable: true,
    });
    await new Function(`return (async () => { ${BOOKMARKLET_SOURCE} })()`)();
    expect(alerted[0]).toContain("Open your IMDb watchlist first");
    expect(copied).toBe("");
  });

  it("is a single javascript: url that can be saved as a bookmark", () => {
    expect(BOOKMARKLET_HREF.startsWith("javascript:")).toBe(true);
    expect(BOOKMARKLET_HREF).not.toContain("\n");
  });
});
