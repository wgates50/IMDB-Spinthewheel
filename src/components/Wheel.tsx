"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, type Ref } from "react";
import type { WatchlistItem } from "@/lib/types";

const YELLOW = "#f5c518";
const YELLOW_DEEP = "#d9ae13";
const DARK = "#1f1f1f";
const DARKER = "#141414";
const LINE = "#000000";

export interface WheelHandle {
  /** Spins to `winnerIndex`; resolves when the wheel comes to rest. */
  spinTo: (winnerIndex: number) => Promise<void>;
  /**
   * Adopts the current items immediately. After a spin the wheel deliberately
   * holds its layout so the winner stays under the pointer; call this when the
   * viewer does something that should visibly change the wheel.
   */
  refresh: () => void;
}

interface WheelProps {
  items: WatchlistItem[];
  spinning: boolean;
  soundOn: boolean;
  ref?: Ref<WheelHandle>;
}

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (ctx.measureText(`${text.slice(0, mid).trimEnd()}…`).width <= maxWidth) low = mid;
    else high = mid - 1;
  }
  return `${text.slice(0, low).trimEnd()}…`;
}

/** Short WebAudio blip for each segment the pointer passes. */
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
        osc.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.05);
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

export function Wheel({ items, spinning, soundOn, ref }: WheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef(0);
  const frameRef = useRef<number>(0);
  const soundRef = useRef(soundOn);
  const tickerRef = useRef<ReturnType<typeof makeTicker> | null>(null);
  /**
   * The wedges currently drawn. Held in a ref rather than read from props so a
   * spin in flight keeps the layout it started with: if the filters change
   * mid-spin, swapping the wedges would land the pointer on a different title
   * than the one already chosen.
   */
  const itemsRef = useRef(items);
  /** Latest props, adopted by the wheel once any spin has finished. */
  const latestItemsRef = useRef(items);
  const spinningRef = useRef(false);
  /** Set once a spin lands, so the result stays under the pointer. */
  const holdingRef = useRef(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = canvas.clientWidth;
    if (!size) return;

    if (canvas.width !== Math.round(size * dpr)) {
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const center = size / 2;
    const radius = center - 6;
    const list = itemsRef.current;

    ctx.save();
    ctx.translate(center, center);

    if (!list.length) {
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = DARK;
      ctx.fill();
      ctx.strokeStyle = "#3a3a3a";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "#8a8a8a";
      ctx.font = `500 ${Math.max(13, size * 0.038)}px Roboto, Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Nothing matches those filters", 0, 0);
      ctx.restore();
      return;
    }

    const segment = (Math.PI * 2) / list.length;
    ctx.rotate(rotationRef.current);

    list.forEach((item, index) => {
      const start = index * segment;
      const end = start + segment;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, start, end);
      ctx.closePath();
      // Two yellows and two greys, so neighbouring wedges stay distinct even
      // when the segment count is odd.
      const palette = [YELLOW, DARK, YELLOW_DEEP, DARKER];
      ctx.fillStyle = palette[index % palette.length];
      ctx.fill();
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const mid = start + segment / 2;
      ctx.save();
      ctx.rotate(mid);
      ctx.textBaseline = "middle";
      const fontSize = Math.max(9, Math.min(15, (size * 0.043) - list.length * 0.12));
      ctx.font = `600 ${fontSize}px Roboto, Arial, sans-serif`;
      ctx.fillStyle = index % 2 === 0 ? "#000000" : "#ffffff";
      const label = truncate(ctx, item.title, radius - 44);

      // Wedges past the vertical would otherwise render upside down, so their
      // labels get turned around to stay readable wherever the wheel stops.
      const facing = (mid + rotationRef.current) % (Math.PI * 2);
      const normalizedFacing = facing < 0 ? facing + Math.PI * 2 : facing;
      if (normalizedFacing > Math.PI / 2 && normalizedFacing < (Math.PI * 3) / 2) {
        ctx.rotate(Math.PI);
        ctx.textAlign = "left";
        ctx.fillText(label, -(radius - 16), 0);
      } else {
        ctx.textAlign = "right";
        ctx.fillText(label, radius - 16, 0);
      }
      ctx.restore();
    });

    ctx.restore();

    // Hub
    ctx.beginPath();
    ctx.arc(center, center, Math.max(26, size * 0.085), 0, Math.PI * 2);
    ctx.fillStyle = "#0d0d0d";
    ctx.fill();
    ctx.strokeStyle = YELLOW;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = YELLOW;
    ctx.font = `700 ${Math.max(10, size * 0.032)}px Roboto, Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("IMDb", center, center);

    // Pointer at 12 o'clock
    ctx.beginPath();
    ctx.moveTo(center, 16);
    ctx.lineTo(center - 13, -6);
    ctx.lineTo(center + 13, -6);
    ctx.closePath();
    ctx.fillStyle = YELLOW;
    ctx.fill();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.stroke();
  }, []);

  useEffect(() => {
    soundRef.current = soundOn;
  }, [soundOn]);

  useEffect(() => {
    latestItemsRef.current = items;
    if (spinningRef.current || holdingRef.current) return;
    itemsRef.current = items;
    draw();
  }, [items, draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

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
        itemsRef.current = latestItemsRef.current;
        draw();
      },
      spinTo(winnerIndex: number) {
        return new Promise<void>((resolve) => {
          // Lock in the wedge layout for the whole spin.
          holdingRef.current = false;
          itemsRef.current = latestItemsRef.current;
          const count = itemsRef.current.length;
          if (!count) {
            resolve();
            return;
          }

          const segment = (Math.PI * 2) / count;
          const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
          const duration = reduced ? 700 : 4200 + Math.random() * 900;
          const turns = reduced ? 1 : 5 + Math.floor(Math.random() * 3);

          // Land the winner under the pointer at 12 o'clock, offset slightly
          // within its wedge so it doesn't always stop dead centre.
          const jitter = (Math.random() - 0.5) * segment * 0.7;
          const target = -Math.PI / 2 - (winnerIndex + 0.5) * segment + jitter;

          const from = rotationRef.current;
          const normalized = ((target - from) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
          const delta = normalized + turns * Math.PI * 2;

          if (soundRef.current) tickerRef.current ??= makeTicker();
          spinningRef.current = true;
          let lastSegment = Math.floor(from / segment);
          const start = performance.now();

          const step = (now: number) => {
            const progress = Math.min(1, (now - start) / duration);
            rotationRef.current = from + delta * easeOutQuart(progress);

            if (soundRef.current) {
              const current = Math.floor(rotationRef.current / segment);
              if (current !== lastSegment) {
                lastSegment = current;
                tickerRef.current?.tick();
              }
            }

            draw();

            if (progress < 1) {
              frameRef.current = requestAnimationFrame(step);
            } else {
              rotationRef.current = ((from + delta) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
              spinningRef.current = false;
              holdingRef.current = true;
              draw();
              resolve();
            }
          };

          cancelAnimationFrame(frameRef.current);
          frameRef.current = requestAnimationFrame(step);
        });
      },
    }),
    [draw],
  );

  return (
    <canvas
      ref={canvasRef}
      className="block w-full aspect-square max-w-[560px] mx-auto"
      role="img"
      aria-label={
        spinning
          ? "Spinning the wheel"
          : `Wheel with ${items.length} title${items.length === 1 ? "" : "s"}`
      }
    />
  );
}
