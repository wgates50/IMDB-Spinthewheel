"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEMO_WATCHLIST } from "@/data/demo";
import { applyFilters, buildFacets } from "@/lib/filters";
import { formatRuntime } from "@/lib/normalize";
import { randomInt, sample } from "@/lib/random";
import { guessRegion, storage, type HistoryEntry, type WatchlistMeta } from "@/lib/storage";
import { DEFAULT_FILTERS, type Filters, type TitleDetails, type WatchlistItem } from "@/lib/types";
import { FiltersPanel } from "./Filters";
import { ResultPanel } from "./ResultPanel";
import { WatchlistImport } from "./WatchlistImport";
import { Wheel, type WheelHandle } from "./Wheel";

/** More wedges than this and the labels stop being readable. */
const MAX_SEGMENTS = 16;
/** How many past winners "skip my last few winners" holds back. */
const RECENT_WINDOW = 5;
const METASCORE_BATCH = 40;

interface AppShellProps {
  hasOmdb: boolean;
  hasTmdb: boolean;
}

export function AppShell({ hasOmdb, hasTmdb }: AppShellProps) {
  const [items, setItems] = useState<WatchlistItem[]>(DEMO_WATCHLIST);
  const [meta, setMeta] = useState<WatchlistMeta | null>(null);
  const [isDemo, setIsDemo] = useState(true);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [region, setRegion] = useState("US");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [soundOn, setSoundOn] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<WatchlistItem | null>(null);
  const [details, setDetails] = useState<TitleDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [failedMetascoreIds, setFailedMetascoreIds] = useState<ReadonlySet<string>>(new Set());
  const [shortlistToken, setShortlistToken] = useState(0);

  const wheelRef = useRef<WheelHandle>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const hydratingRef = useRef(false);

  /*
   * Restore anything saved from a previous visit. localStorage is not readable
   * during the server render, so this has to happen after mount — the one
   * place this component sets state from an effect body.
   */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const saved = storage.loadWatchlist();
    if (saved?.length) {
      setItems(saved);
      setIsDemo(false);
      setMeta(storage.loadMeta());
    }
    setFilters(storage.loadFilters());
    setRegion(storage.loadRegion() ?? guessRegion());
    setHistory(storage.loadHistory());
    setSoundOn(storage.loadSound());
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (hydrated) storage.saveFilters(filters);
  }, [filters, hydrated]);

  useEffect(() => {
    if (hydrated) storage.saveRegion(region);
  }, [region, hydrated]);

  const facets = useMemo(() => buildFacets(items), [items]);

  const excludedIds = useMemo(
    () => new Set(history.slice(0, RECENT_WINDOW).map((entry) => entry.id)),
    [history],
  );

  const candidates = useMemo(() => {
    const withExclusions = applyFilters(items, filters, excludedIds);
    if (withExclusions.length) return withExclusions;
    // Rather than dead-ending, fall back to the unexcluded pool once the
    // recent-winner window has eaten everything that matches.
    return applyFilters(items, { ...filters, skipRecentWinners: false });
  }, [items, filters, excludedIds]);

  /*
   * Which titles are actually drawn. A big watchlist would render as an
   * unreadable pinwheel, so the wheel shows a random shortlist instead. Drawing
   * a uniform sample and then picking uniformly from it leaves every matching
   * title equally likely, so the shortlist costs nothing in fairness.
   * The wheel itself holds this steady for the length of a spin.
   */
  const wheelItems = useMemo(
    () => sample(candidates, MAX_SEGMENTS),
    // A new token is how the "shuffle" button asks for a fresh shortlist.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [candidates, shortlistToken],
  );

  /* ---- Metascore hydration -------------------------------------------- */

  const needsMetascores = hasOmdb && filters.minMetascore > 0;

  // Only look up titles that already clear every other filter — sweeping a
  // whole watchlist would burn an OMDb daily quota for nothing.
  const metascoreScope = useMemo(
    () =>
      needsMetascores ? applyFilters(items, { ...filters, minMetascore: 0 }, excludedIds) : [],
    [items, filters, excludedIds, needsMetascores],
  );

  const pendingMetascoreIds = useMemo(
    () =>
      metascoreScope
        .filter((item) => item.metascore === undefined && !failedMetascoreIds.has(item.id))
        .map((item) => item.id),
    [metascoreScope, failedMetascoreIds],
  );

  const metaProgress = needsMetascores
    ? { done: metascoreScope.length - pendingMetascoreIds.length, total: metascoreScope.length }
    : null;

  useEffect(() => {
    if (!pendingMetascoreIds.length || hydratingRef.current) return;

    hydratingRef.current = true;
    const batch = pendingMetascoreIds.slice(0, METASCORE_BATCH);

    void (async () => {
      try {
        const response = await fetch("/api/metascores", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ids: batch }),
        });
        const data = await response.json();
        const scores: Record<string, number | null> = data?.scores ?? {};

        const missing = batch.filter((id) => !(id in scores));
        if (missing.length) {
          setFailedMetascoreIds((current) => new Set([...current, ...missing]));
        }

        setItems((current) => {
          const next = current.map((item) =>
            item.id in scores ? { ...item, metascore: scores[item.id] } : item,
          );
          if (!isDemo) storage.saveWatchlist(next);
          return next;
        });
      } catch {
        // Give up on this batch rather than looping on a failing upstream.
        setFailedMetascoreIds((current) => new Set([...current, ...batch]));
        setNotice("Could not load Metascores just now.");
      } finally {
        hydratingRef.current = false;
      }
    })();
  }, [pendingMetascoreIds, isDemo]);

  /* ---- Spinning -------------------------------------------------------- */

  const loadDetails = useCallback(
    async (item: WatchlistItem, forRegion: string) => {
      setDetailsLoading(true);
      setDetailsError(null);
      try {
        const params = new URLSearchParams({
          region: forRegion,
          title: item.title,
          type: item.titleType,
        });
        if (item.year) params.set("year", String(item.year));
        if (item.genres.length) params.set("genres", item.genres.join(","));
        if (item.imdbRating) params.set("rating", String(item.imdbRating));
        if (item.runtime) params.set("runtime", String(item.runtime));

        const response = await fetch(`/api/title/${item.id}?${params}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error ?? "Could not load details.");
        setDetails(data as TitleDetails);
      } catch (error) {
        setDetailsError(error instanceof Error ? error.message : "Could not load details.");
      } finally {
        setDetailsLoading(false);
      }
    },
    [],
  );

  const spin = useCallback(async () => {
    if (spinning || !wheelItems.length) return;

    setSpinning(true);
    setDetails(null);
    setDetailsError(null);
    setNotice(null);

    const winnerIndex = randomInt(wheelItems.length);
    const picked = wheelItems[winnerIndex];

    await wheelRef.current?.spinTo(winnerIndex);

    setWinner(picked);
    setSpinning(false);

    setHistory((current) => {
      const next = [
        { id: picked.id, title: picked.title, year: picked.year, spunAt: new Date().toISOString() },
        ...current.filter((entry) => entry.id !== picked.id),
      ];
      storage.saveHistory(next);
      return next;
    });

    void loadDetails(picked, region);
    requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [spinning, wheelItems, region, loadDetails]);

  /**
   * The wheel holds its landed layout so the winner stays under the pointer.
   * Anything the viewer does that should visibly change the wheel releases it.
   */
  const releaseWheel = useCallback(() => wheelRef.current?.refresh(), []);

  const handleFiltersChange = useCallback(
    (next: Filters) => {
      setFilters(next);
      releaseWheel();
    },
    [releaseWheel],
  );

  const handleShuffle = useCallback(() => {
    setShortlistToken((token) => token + 1);
    releaseWheel();
  }, [releaseWheel]);

  const handleRegionChange = useCallback(
    (next: string) => {
      setRegion(next);
      if (winner) void loadDetails(winner, next);
    },
    [winner, loadDetails],
  );

  const handleImported = useCallback(
    (imported: WatchlistItem[], importedMeta: WatchlistMeta, warning?: string) => {
      setFailedMetascoreIds(new Set());
      setItems(imported);
      setMeta(importedMeta);
      setIsDemo(false);
      setWinner(null);
      setDetails(null);
      setNotice(warning ?? null);
      storage.saveWatchlist(imported);
      storage.saveMeta(importedMeta);
      releaseWheel();
    },
    [releaseWheel],
  );

  const handleReset = useCallback(() => {
    storage.clearWatchlist();
    setFailedMetascoreIds(new Set());
    setItems(DEMO_WATCHLIST);
    setMeta(null);
    setIsDemo(true);
    setWinner(null);
    setDetails(null);
    setNotice(null);
    releaseWheel();
  }, [releaseWheel]);

  const toggleSound = useCallback(() => {
    setSoundOn((current) => {
      storage.saveSound(!current);
      return !current;
    });
  }, []);

  const poolNote =
    candidates.length > MAX_SEGMENTS
      ? `${MAX_SEGMENTS} shortlisted at random from ${candidates.length} matching titles — every one of the ${candidates.length} has an equal chance.`
      : null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="rounded bg-imdb-yellow px-2 py-1 text-lg font-extrabold tracking-tight text-black">
            IMDb
          </span>
          <div>
            <h1 className="text-xl font-bold leading-tight sm:text-2xl">Spin the Wheel</h1>
            <p className="text-xs text-imdb-muted">Let the wheel decide what you watch</p>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleSound}
          aria-pressed={soundOn}
          className="chip"
          data-active={soundOn}
        >
          {soundOn ? "Sound on" : "Sound off"}
        </button>
      </header>

      {!hasTmdb && !hasOmdb ? (
        <p className="panel mb-5 p-3 text-sm text-imdb-muted">
          Running without API keys: the wheel and every filter except Metascore work from your
          watchlist alone. Add a TMDB and OMDb key to fill in cast, reviews, Metascore and streaming
          — the README has the two-minute version.
        </p>
      ) : null}

      {notice ? (
        <p className="panel mb-5 border-imdb-yellow/40 p-3 text-sm">
          {notice}{" "}
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-imdb-muted underline underline-offset-2 hover:text-imdb-yellow"
          >
            Dismiss
          </button>
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div className="space-y-5">
          <WatchlistImport
            meta={meta}
            isDemo={isDemo}
            onImported={handleImported}
            onReset={handleReset}
          />
          <FiltersPanel
            filters={filters}
            facets={facets}
            onChange={handleFiltersChange}
            matchCount={candidates.length}
            totalCount={items.length}
            hasOmdb={hasOmdb}
            metascoreProgress={metaProgress}
          />
          {history.length ? (
            <div className="panel p-4 sm:p-5">
              <h2 className="mb-2.5 text-lg font-bold">Recent spins</h2>
              <ul className="space-y-1.5 text-sm">
                {history.slice(0, 8).map((entry) => (
                  <li key={entry.id} className="flex items-baseline justify-between gap-2">
                    <a
                      href={`https://www.imdb.com/title/${entry.id}/`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="truncate hover:text-imdb-yellow"
                    >
                      {entry.title}
                    </a>
                    {entry.year ? (
                      <span className="shrink-0 text-xs text-imdb-muted">{entry.year}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => {
                  storage.saveHistory([]);
                  setHistory([]);
                }}
                className="mt-3 text-xs text-imdb-muted underline underline-offset-2 hover:text-imdb-yellow"
              >
                Clear history
              </button>
            </div>
          ) : null}
        </div>

        <div className="space-y-5">
          <div className="panel p-4 sm:p-6">
            <Wheel ref={wheelRef} items={wheelItems} spinning={spinning} soundOn={soundOn} />

            <div className="mt-5 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => void spin()}
                disabled={spinning || !wheelItems.length}
                className="w-full max-w-xs rounded-lg bg-imdb-yellow px-6 py-3 text-lg font-extrabold text-black transition-colors hover:bg-imdb-yellow-dim disabled:cursor-not-allowed disabled:opacity-40"
              >
                {spinning ? "Spinning…" : winner ? "Spin again" : "Spin"}
              </button>

              <button
                type="button"
                onClick={handleShuffle}
                disabled={spinning || candidates.length <= MAX_SEGMENTS}
                className="text-xs text-imdb-muted underline underline-offset-2 hover:text-imdb-yellow disabled:opacity-40 disabled:no-underline disabled:hover:text-imdb-muted"
              >
                Shuffle the shortlist
              </button>

              {!candidates.length ? (
                <p className="text-center text-sm text-imdb-red">
                  Nothing matches those filters — loosen them a little.
                </p>
              ) : poolNote ? (
                <p className="max-w-md text-center text-xs text-imdb-muted">{poolNote}</p>
              ) : null}
            </div>

            {candidates.length ? (
              <details className="mt-4 border-t border-imdb-line pt-3">
                <summary className="cursor-pointer text-xs text-imdb-muted hover:text-imdb-yellow">
                  See all {candidates.length} matching title{candidates.length === 1 ? "" : "s"}
                </summary>
                <ul className="mt-2.5 max-h-64 space-y-1 overflow-y-auto pr-1 text-sm">
                  {candidates.map((item) => (
                    <li key={item.id} className="flex items-baseline justify-between gap-3">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="truncate hover:text-imdb-yellow"
                      >
                        {item.title}
                      </a>
                      <span className="shrink-0 text-xs text-imdb-muted">
                        {[
                          item.year,
                          item.imdbRating ? `★ ${item.imdbRating.toFixed(1)}` : null,
                          formatRuntime(item.runtime),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>

          <div ref={resultRef}>
            {winner ? (
              <ResultPanel
                item={winner}
                details={details}
                loading={detailsLoading}
                error={detailsError}
                region={region}
                onRegionChange={handleRegionChange}
                onSpinAgain={() => void spin()}
              />
            ) : (
              <div className="panel p-6 text-center text-sm text-imdb-muted">
                Hit spin and the pick shows up here — plot, cast, reviews and where to stream it.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
