import { parseImdbCsv } from "./csv";
import { fetchText, UpstreamError } from "./http";
import { normalizeTitleType, titleUrl } from "./normalize";
import type { WatchlistItem } from "./types";

export interface ListImportResult {
  items: WatchlistItem[];
  /** How the data was obtained, surfaced in the UI so gaps are explainable. */
  strategy: "export-csv" | "embedded-json" | "linked-data";
  /** True when items are missing metadata that filters depend on. */
  partial: boolean;
  source: string;
}

export interface ListRef {
  /**
   * "user"  - a classic ur… account id
   * "list"  - an ls… list id
   * "share" - the opaque p.… id IMDb's "share watchlist" button now produces
   */
  kind: "user" | "list" | "share";
  id: string;
}

/**
 * Accepts a bare id or any IMDb watchlist/list URL, in any of the three
 * shapes IMDb currently hands out:
 *   https://www.imdb.com/user/ur12345678/watchlist/
 *   https://www.imdb.com/list/ls123456789/
 *   https://www.imdb.com/user/p.ci6puprdyl2jjrer2n4br4wrsm/watchlist/?ref_=ext_shr_lnk
 */
export function parseListRef(input: string): ListRef | null {
  const trimmed = input.trim();

  // Share ids are checked first: they are opaque, so a ur/ls pattern could in
  // principle appear inside one.
  const shareId =
    trimmed.match(/\/user\/(p\.[A-Za-z0-9_-]{8,64})/)?.[1] ??
    trimmed.match(/^(p\.[A-Za-z0-9_-]{8,64})$/)?.[1];
  if (shareId) return { kind: "share", id: shareId };

  const listId = trimmed.match(/ls\d{6,12}/i)?.[0];
  if (listId) return { kind: "list", id: listId.toLowerCase() };

  const userId = trimmed.match(/ur\d{5,12}/i)?.[0];
  if (userId) return { kind: "user", id: userId.toLowerCase() };

  return null;
}

/** Share links have no CSV export endpoint, so there is nothing to try. */
function exportUrl(ref: ListRef): string | null {
  if (ref.kind === "share") return null;
  return ref.kind === "list"
    ? `https://www.imdb.com/list/${ref.id}/export`
    : `https://www.imdb.com/user/${ref.id}/watchlist/export`;
}

function pageUrl(ref: ListRef, page: number): string {
  const base =
    ref.kind === "list"
      ? `https://www.imdb.com/list/${ref.id}/`
      : `https://www.imdb.com/user/${ref.id}/watchlist/`;
  return page > 1 ? `${base}?page=${page}` : base;
}

type Json = { [key: string]: unknown } | unknown[] | string | number | boolean | null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (isRecord(value) && typeof value.text === "string") return value.text;
  return null;
}

/**
 * IMDb's pages embed the same GraphQL title shape wherever they list titles,
 * but the path to it changes between page templates and releases. Walking the
 * tree for anything that looks like a title node survives those reshuffles.
 */
function collectTitleNodes(root: Json, out: Map<string, Record<string, unknown>>): void {
  const stack: Json[] = [root];
  let visited = 0;

  while (stack.length && visited < 200_000) {
    const node = stack.pop();
    visited += 1;
    if (Array.isArray(node)) {
      for (const child of node) stack.push(child as Json);
      continue;
    }
    if (!isRecord(node)) continue;

    const id = typeof node.id === "string" ? node.id : null;
    const name = text(node.titleText) ?? text(node.originalTitleText);
    if (id && /^tt\d{6,10}$/.test(id) && name && !out.has(id)) {
      out.set(id, node);
    }

    for (const child of Object.values(node)) stack.push(child as Json);
  }
}

function nodeToItem(id: string, node: Record<string, unknown>): WatchlistItem {
  const name = text(node.titleText) ?? text(node.originalTitleText) ?? id;

  const releaseYear = isRecord(node.releaseYear) ? node.releaseYear : null;
  const year = typeof releaseYear?.year === "number" ? releaseYear.year : null;

  const typeNode = isRecord(node.titleType) ? node.titleType : null;
  const { label, category } = normalizeTitleType(
    (typeof typeNode?.id === "string" ? typeNode.id : null) ?? text(node.titleType),
  );

  const ratings = isRecord(node.ratingsSummary) ? node.ratingsSummary : null;
  const runtimeNode = isRecord(node.runtime) ? node.runtime : null;
  const seconds = typeof runtimeNode?.seconds === "number" ? runtimeNode.seconds : null;

  const genresNode = isRecord(node.titleGenres) ? node.titleGenres : null;
  const genreList = Array.isArray(genresNode?.genres) ? genresNode.genres : [];
  const genres = genreList
    .map((entry) => (isRecord(entry) ? text(entry.genre) : null))
    .filter((value): value is string => Boolean(value));

  const releaseDateNode = isRecord(node.releaseDate) ? node.releaseDate : null;
  const releaseDate =
    releaseDateNode &&
    typeof releaseDateNode.year === "number" &&
    typeof releaseDateNode.month === "number" &&
    typeof releaseDateNode.day === "number"
      ? `${releaseDateNode.year}-${String(releaseDateNode.month).padStart(2, "0")}-${String(
          releaseDateNode.day,
        ).padStart(2, "0")}`
      : null;

  return {
    id,
    title: name,
    year,
    titleType: label,
    category,
    imdbRating: typeof ratings?.aggregateRating === "number" ? ratings.aggregateRating : null,
    numVotes: typeof ratings?.voteCount === "number" ? ratings.voteCount : null,
    runtime: seconds ? Math.round(seconds / 60) : null,
    genres,
    directors: [],
    url: titleUrl(id),
    addedAt: null,
    releaseDate,
  };
}

export function itemsFromEmbeddedJson(html: string): WatchlistItem[] {
  const nodes = new Map<string, Record<string, unknown>>();
  const scripts = html.matchAll(
    /<script[^>]+type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const match of scripts) {
    try {
      collectTitleNodes(JSON.parse(match[1]) as Json, nodes);
    } catch {
      // A script block that is not valid JSON is simply not the one we want.
    }
  }
  return [...nodes.entries()].map(([id, node]) => nodeToItem(id, node));
}

export function itemsFromLinkedData(html: string): WatchlistItem[] {
  const items = new Map<string, WatchlistItem>();
  const blocks = html.matchAll(
    /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
  );

  for (const block of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block[1]);
    } catch {
      continue;
    }
    if (!isRecord(parsed)) continue;
    const elements = Array.isArray(parsed.itemListElement) ? parsed.itemListElement : [];
    for (const element of elements) {
      if (!isRecord(element)) continue;
      const inner = isRecord(element.item) ? element.item : element;
      const url = typeof inner.url === "string" ? inner.url : "";
      const id = url.match(/tt\d{6,10}/)?.[0];
      const name = typeof inner.name === "string" ? inner.name : null;
      if (!id || !name || items.has(id)) continue;
      const { label, category } = normalizeTitleType(
        typeof inner["@type"] === "string" ? inner["@type"] : null,
      );
      items.set(id, {
        id,
        title: name,
        year: null,
        titleType: label,
        category,
        imdbRating: null,
        numVotes: null,
        runtime: null,
        genres: [],
        directors: [],
        url: titleUrl(id),
        addedAt: null,
        releaseDate: null,
      });
    }
  }

  return [...items.values()];
}

const MAX_PAGES = 6;

/**
 * Best-effort import of a *public* IMDb watchlist or list. The CSV export is
 * tried first because it carries the metadata the filters need; the page
 * scrapes are fallbacks for when IMDb declines to serve the export.
 */
export async function importList(ref: ListRef): Promise<ListImportResult> {
  const source = pageUrl(ref, 1);

  const csvUrl = exportUrl(ref);
  if (csvUrl) {
    try {
      const csv = await fetchText(csvUrl);
      if (/(^|,)\s*"?Const"?\s*,/i.test(csv.slice(0, 2000))) {
        return { items: parseImdbCsv(csv), strategy: "export-csv", partial: false, source };
      }
    } catch {
      // Export is only served for public lists, and not on every account.
    }
  }

  const collected = new Map<string, WatchlistItem>();
  let strategy: ListImportResult["strategy"] = "embedded-json";
  let sawPage = false;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    let html: string;
    try {
      html = await fetchText(pageUrl(ref, page));
    } catch (error) {
      // Later pages failing just means the list ended; the first page failing
      // means we never got in at all.
      if (page > 1) break;
      const status = error instanceof UpstreamError ? error.status : 0;
      throw new UpstreamError(
        status === 404
          ? "IMDb has no such list."
          : status === 403 || status === 429
            ? "IMDb refused the request — it blocks automated page reads, and does so more often from hosted servers. Use the CSV export instead."
            : "Could not reach IMDb just now. Use the CSV export if this keeps happening.",
        status || 502,
      );
    }
    sawPage = true;

    let found = itemsFromEmbeddedJson(html);
    if (!found.length) {
      found = itemsFromLinkedData(html);
      if (found.length) strategy = "linked-data";
    }

    const before = collected.size;
    for (const item of found) {
      if (!collected.has(item.id)) collected.set(item.id, item);
    }
    if (collected.size === before) break;
  }

  const items = [...collected.values()];
  if (!items.length) {
    throw new UpstreamError(
      sawPage
        ? "IMDb returned the page but no titles could be read from it. The list may be private, or IMDb changed its page format — use the CSV export instead."
        : "Could not reach that list on IMDb.",
      422,
    );
  }

  const partial = items.some((item) => !item.genres.length || item.imdbRating === null);
  return { items, strategy, partial, source };
}
