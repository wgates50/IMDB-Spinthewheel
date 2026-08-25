"use client";

import { DEFAULT_FILTERS, type Filters, type WatchlistItem } from "./types";

const KEYS = {
  watchlist: "spinwheel.watchlist.v1",
  meta: "spinwheel.watchlist-meta.v1",
  filters: "spinwheel.filters.v1",
  region: "spinwheel.region.v1",
  history: "spinwheel.history.v1",
  sound: "spinwheel.sound.v1",
} as const;

export interface WatchlistMeta {
  source: string;
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
};

/** Best guess at the viewer's streaming region, used to seed the picker. */
export function guessRegion(): string {
  if (typeof navigator === "undefined") return "US";
  const locale = navigator.languages?.[0] ?? navigator.language ?? "en-US";
  const region = locale.split("-")[1];
  return region && /^[A-Za-z]{2}$/.test(region) ? region.toUpperCase() : "US";
}
