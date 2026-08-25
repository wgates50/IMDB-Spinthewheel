import {
  extractImdbId,
  normalizeTitleType,
  parseNumber,
  parseYear,
  splitList,
  titleUrl,
} from "./normalize";
import type { WatchlistItem } from "./types";

/**
 * RFC 4180 CSV reader. IMDb exports quote any field containing a comma
 * (titles and genre lists both do), and occasionally embed newlines in the
 * Description column, so a split(",") shortcut is not good enough.
 */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim().length > 0));
}

/** Header spellings IMDb has shipped across export formats, newest first. */
const COLUMN_ALIASES: Record<string, string[]> = {
  id: ["const", "imdb id", "imdbid", "tconst"],
  title: ["title", "primary title", "original title"],
  type: ["title type", "titletype", "type"],
  rating: ["imdb rating", "imdbrating", "average rating"],
  votes: ["num votes", "numvotes", "votes"],
  runtime: ["runtime (mins)", "runtime (minutes)", "runtime", "runtimemins"],
  year: ["year", "start year"],
  genres: ["genres", "genre"],
  directors: ["directors", "director"],
  url: ["url", "imdb url"],
  added: ["created", "date added", "modified"],
  released: ["release date", "released"],
};

function buildIndex(header: string[]): Record<string, number> {
  const lowered = header.map((cell) => cell.trim().toLowerCase());
  const index: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      const at = lowered.indexOf(alias);
      if (at !== -1) {
        index[field] = at;
        break;
      }
    }
  }
  return index;
}

export class CsvImportError extends Error {}

/**
 * Turns an IMDb watchlist/list/ratings CSV export into watchlist items.
 * Rows without a resolvable IMDb const are skipped rather than failing the
 * whole import — exports occasionally carry a trailing summary line.
 */
export function parseImdbCsv(input: string): WatchlistItem[] {
  const rows = parseCsv(input);
  if (rows.length < 2) {
    throw new CsvImportError("That file has no rows in it.");
  }

  const index = buildIndex(rows[0]);
  if (index.id === undefined || index.title === undefined) {
    throw new CsvImportError(
      "That does not look like an IMDb export — no 'Const' and 'Title' columns found.",
    );
  }

  const seen = new Set<string>();
  const items: WatchlistItem[] = [];

  for (const cells of rows.slice(1)) {
    const cell = (field: string): string | null => {
      const at = index[field];
      if (at === undefined) return null;
      const value = (cells[at] ?? "").trim();
      return value.length ? value : null;
    };

    const id = extractImdbId(cell("id") ?? "");
    const title = cell("title");
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);

    const { label, category } = normalizeTitleType(cell("type"));
    const runtime = parseNumber(cell("runtime"));

    items.push({
      id,
      title,
      year: parseYear(cell("year")) ?? parseYear(cell("released")),
      titleType: label,
      category,
      imdbRating: parseNumber(cell("rating")),
      numVotes: parseNumber(cell("votes")),
      runtime: runtime === null ? null : Math.round(runtime),
      genres: splitList(cell("genres")),
      directors: splitList(cell("directors")),
      url: cell("url") ?? titleUrl(id),
      addedAt: cell("added"),
      releaseDate: cell("released"),
    });
  }

  if (!items.length) {
    throw new CsvImportError("No titles found in that export.");
  }

  return items;
}
