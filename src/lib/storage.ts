"use client";

import { DEFAULT_FILTERS, type Filters, type WatchlistItem } from "./types";

const KEYS = {
  watchlist: "spinwheel.watchlist.v1",
  meta: "spinwheel.watchlist-meta.v1",
  filters: "spinwheel.filters.v1",
  region: "spinwheel.region.v1",
  history: "spinwheel.history.v1",
  sound: "spinwheel.sound.v1",
  lastLink: "spinwheel.last-link.v1",
} as const;

export interface WatchlistMeta {
  /** Filename for a CSV import, or the list URL for a link import. */
  source: string;
  /** Which importer produced this list, so the UI can offer a re-sync. */
  kind: "file" | "link";
  importedAt: string;
  count: number;
}

export interface HistoryEntry {
  id: string;
  title: string;
  year: number | null;
  spunAt: string;
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    // Corrupt or blocked storage should never take the app down.
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing and quota limits are both survivable.
  }
}

export const storage = {
  loadWatchlist: () => read<WatchlistItem[] | null>(KEYS.watchlist, null),
  saveWatchlist: (items: WatchlistItem[]) => write(KEYS.watchlist, items),
  clearWatchlist: () => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(KEYS.watchlist);
    window.localStorage.removeItem(KEYS.meta);
  },

  loadMeta: () => read<WatchlistMeta | null>(KEYS.meta, null),
  saveMeta: (meta: WatchlistMeta) => write(KEYS.meta, meta),

  loadFilters: (): Filters => ({ ...DEFAULT_FILTERS, ...read(KEYS.filters, {}) }),
  saveFilters: (filters: Filters) => write(KEYS.filters, filters),

  loadRegion: () => read<string | null>(KEYS.region, null),
  saveRegion: (region: string) => write(KEYS.region, region),

  loadHistory: () => read<HistoryEntry[]>(KEYS.history, []),
  saveHistory: (entries: HistoryEntry[]) => write(KEYS.history, entries.slice(0, 30)),

  loadSound: () => read<boolean>(KEYS.sound, false),
  saveSound: (on: boolean) => write(KEYS.sound, on),

  /**
   * The last IMDb link imported, kept separately from the watchlist so the
   * field stays pre-filled even after the list is cleared.
   */
  loadLastLink: () => read<string | null>(KEYS.lastLink, null),
  saveLastLink: (link: string) => write(KEYS.lastLink, link),
};

/** "3 minutes ago", "2 days ago" — for showing how stale an import is. */
export function relativeTime(iso: string): string | null {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;

  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return "just now";

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["minute", 60],
    ["hour", 3600],
    ["day", 86400],
    ["month", 2_592_000],
    ["year", 31_536_000],
  ];

  let chosen: Intl.RelativeTimeFormatUnit = "minute";
  let size = 60;
  for (const [unit, unitSeconds] of units) {
    if (seconds >= unitSeconds) {
      chosen = unit;
      size = unitSeconds;
    }
  }

  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
    -Math.round(seconds / size),
    chosen,
  );
}

/** Best guess at the viewer's streaming region, used to seed the picker. */
export function guessRegion(): string {
  if (typeof navigator === "undefined") return "US";
  const locale = navigator.languages?.[0] ?? navigator.language ?? "en-US";
  const region = locale.split("-")[1];
  return region && /^[A-Za-z]{2}$/.test(region) ? region.toUpperCase() : "US";
}
