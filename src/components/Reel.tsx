"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { formatRuntime } from "@/lib/normalize";
import { shuffle } from "@/lib/random";
import type { WatchlistItem } from "@/lib/types";

/** Fixed so the scroll maths stays exact; the viewport is a multiple of it. */
const ROW_HEIGHT = 56;
const VISIBLE_ROWS = 5;
const CENTRE_ROW = Math.floor(VISIBLE_ROWS / 2);
/** Rows the reel travels through before landing, so a spin feels like one. */
const MIN_RUNWAY = 45;

export interface ReelHandle {
  /** Spins the barrel to rest on `winner`; resolves once it stops. */
  spinTo: (winner: WatchlistItem) => Promise<void>;
  /** Re-draws from the current items — used after the viewer changes filters. */
  refresh: () => void;
}

interface ReelProps {
  items: WatchlistItem[];
  soundOn: boolean;
  ref?: Ref<ReelHandle>;
}

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

/** Short blip as each title clicks past the centre line. */
function makeTicker(): { tick: () => void; close: () => void } {
  let ctx: AudioContext | null = null;
  return {
    tick() {
      try {
        type AudioCtor = typeof AudioContext;
        const Ctor: AudioCtor | undefined =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
        if (!Ctor) return;
        ctx ??= new Ctor();
        if (ctx.state === "suspended") void ctx.resume();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(720, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.045);
      } catch {
        // Audio is decoration; never let it break a spin.
      }
    },
    close() {
      void ctx?.close();
      ctx = null;
    },
  };
}

/**
 * Builds the strip of rows the reel scrolls through: enough shuffled runway to
 * look like a spin, the winner at a known index, then a few more rows so the
 * barrel never appears to run out underneath it.
 */
function buildStrip(
  items: readonly WatchlistItem[],
  winner: WatchlistItem,
): { strip: WatchlistItem[]; winnerIndex: number } {
  const strip: WatchlistItem[] = [];
  while (strip.length < MIN_RUNWAY) {
    strip.push(...shuffle(items));
  }

  const winnerIndex = strip.length;
  strip.push(winner);
  strip.push(...shuffle(items).slice(0, VISIBLE_ROWS));

  return { strip, winnerIndex };
}

export function Reel({ items, soundOn, ref }: ReelProps) {
  const [strip, setStrip] = useState<WatchlistItem[]>(() => items.slice(0, VISIBLE_ROWS * 3));
  const stripRef = useRef<HTMLUListElement>(null);
  const offsetRef = useRef(0);
  const frameRef = useRef(0);
  const spinningRef = useRef(false);
  /**
   * Set once a spin lands. Without it the reel would redraw the moment the
   * winner drops out of the pool (it becomes a "recent winner"), scrolling the
   * result out of the marker band right as the viewer looks at it.
   */
  const holdingRef = useRef(false);
  const latestItemsRef = useRef(items);
  const soundRef = useRef(soundOn);
  const tickerRef = useRef<ReturnType<typeof makeTicker> | null>(null);

  const paint = useCallback(() => {
    const node = stripRef.current;
    if (node) node.style.transform = `translate3d(0, ${offsetRef.current}px, 0)`;
  }, []);

  useEffect(() => {
    soundRef.current = soundOn;
  }, [soundOn]);

  useEffect(() => {
    latestItemsRef.current = items;
    if (spinningRef.current || holdingRef.current) return;
    // Idle state simply shows a slice of the pool sitting under the marker.
    setStrip(items.length ? [...items, ...items].slice(0, VISIBLE_ROWS * 3) : []);
    offsetRef.current = 0;
    paint();
  }, [items, paint]);

  useEffect(() => {
    paint();
  }, [strip, paint]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(frameRef.current);
      tickerRef.current?.close();
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      refresh() {
        if (spinningRef.current) return;
        holdingRef.current = false;
        const pool = latestItemsRef.current;
        setStrip(pool.length ? [...pool, ...pool].slice(0, VISIBLE_ROWS * 3) : []);
        offsetRef.current = 0;
        paint();
      },

      spinTo(winner: WatchlistItem) {
        return new Promise<void>((resolve) => {
          const pool = latestItemsRef.current;
          if (!pool.length) {
            resolve();
            return;
          }

          const { strip: nextStrip, winnerIndex } = buildStrip(pool, winner);
          setStrip(nextStrip);
          spinningRef.current = true;
          holdingRef.current = false;

          // The strip starts just above the viewport and travels up until the
          // winner sits in the centre row.
          const from = 0;
          const to = CENTRE_ROW * ROW_HEIGHT - winnerIndex * ROW_HEIGHT;
          offsetRef.current = from;

          const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
          const duration = reduced ? 600 : 3600 + Math.random() * 800;

          if (soundRef.current) tickerRef.current ??= makeTicker();
          let lastRow = 0;
          const start = performance.now();

          const step = (now: number) => {
            const progress = Math.min(1, (now - start) / duration);
            offsetRef.current = from + (to - from) * easeOutQuart(progress);

            if (soundRef.current) {
              const row = Math.floor(-offsetRef.current / ROW_HEIGHT);
              if (row !== lastRow) {
                lastRow = row;
                tickerRef.current?.tick();
              }
            }

            paint();

            if (progress < 1) {
              frameRef.current = requestAnimationFrame(step);
            } else {
              offsetRef.current = to;
              paint();
              spinningRef.current = false;
              holdingRef.current = true;
              resolve();
            }
          };

          cancelAnimationFrame(frameRef.current);
          // Paint the new strip at its start offset before the first frame.
          requestAnimationFrame(() => {
            paint();
            frameRef.current = requestAnimationFrame(step);
          });
        });
      },
    }),
    [paint],
  );

  const viewportHeight = ROW_HEIGHT * VISIBLE_ROWS;

  return (
    <div
      className="relative mx-auto w-full max-w-xl overflow-hidden rounded-xl border border-imdb-line bg-imdb-black"
      style={{ height: viewportHeight }}
      role="img"
      aria-label={`Reel of ${items.length} title${items.length === 1 ? "" : "s"}`}
    >
      {/* Fades the rows out towards the rim so the strip reads as a barrel. */}
      <div
        className="pointer-events-none absolute inset-0 z-20"
        style={{
          background:
            "linear-gradient(to bottom, #000 0%, rgba(0,0,0,0.72) 12%, rgba(0,0,0,0) 38%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.72) 88%, #000 100%)",
        }}
      />

      {/* The selector band the winning title comes to rest in. */}
      <div
        className="pointer-events-none absolute inset-x-0 z-10 border-y-2 border-imdb-yellow bg-imdb-yellow/10"
        style={{ top: CENTRE_ROW * ROW_HEIGHT, height: ROW_HEIGHT }}
      >
        <span className="absolute left-0 top-1/2 -translate-y-1/2 border-y-[7px] border-l-[10px] border-y-transparent border-l-imdb-yellow" />
        <span className="absolute right-0 top-1/2 -translate-y-1/2 border-y-[7px] border-r-[10px] border-y-transparent border-r-imdb-yellow" />
      </div>

      {items.length ? (
        <ul ref={stripRef} className="will-change-transform">
          {strip.map((item, index) => (
            <li
              key={`${item.id}-${index}`}
              className="flex items-center justify-between gap-3 px-4 sm:px-6"
              style={{ height: ROW_HEIGHT }}
            >
              <span className="truncate text-base font-semibold sm:text-lg">{item.title}</span>
              <span className="shrink-0 text-xs text-imdb-muted tabular-nums">
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
      ) : (
        <p className="flex h-full items-center justify-center text-sm text-imdb-muted">
          Nothing matches those filters
        </p>
      )}
    </div>
  );
}
