/** Uniform integer in [0, max). Uses crypto when available. */
export function randomInt(max: number): number {
  if (max <= 0) return 0;
  const globalCrypto = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (globalCrypto?.getRandomValues) {
    // Rejection sampling keeps the draw uniform rather than biasing low values.
    const limit = Math.floor(0x100000000 / max) * max;
    const buffer = new Uint32Array(1);
    let value = 0;
    do {
      globalCrypto.getRandomValues(buffer);
      value = buffer[0];
    } while (value >= limit);
    return value % max;
  }
  return Math.floor(Math.random() * max);
}

export function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Picks `count` items uniformly at random without replacement. Used to build a
 * readable wheel out of a large pool: a uniform sample followed by a uniform
 * pick from that sample is still a uniform pick over the whole pool, so a big
 * watchlist stays fair even though only a slice of it is drawn.
 */
export function sample<T>(items: readonly T[], count: number): T[] {
  if (items.length <= count) return shuffle(items);
  return shuffle(items).slice(0, count);
}
