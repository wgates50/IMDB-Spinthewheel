import { describe, expect, it } from "vitest";
import { randomInt, sample, shuffle } from "@/lib/random";

describe("randomInt", () => {
  it("stays inside the range", () => {
    for (let i = 0; i < 500; i += 1) {
      const value = randomInt(7);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(7);
    }
  });

  it("covers every value over enough draws", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i += 1) seen.add(randomInt(5));
    expect(seen.size).toBe(5);
  });
});

describe("shuffle", () => {
  it("keeps every element exactly once", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const result = shuffle(input);
    expect(result).toHaveLength(input.length);
    expect([...result].sort((a, b) => a - b)).toEqual(input);
  });

  it("does not mutate its input", () => {
    const input = [1, 2, 3];
    shuffle(input);
    expect(input).toEqual([1, 2, 3]);
  });
});

describe("sample", () => {
  it("returns the whole pool when it is smaller than the ask", () => {
    expect(sample([1, 2, 3], 10).sort()).toEqual([1, 2, 3]);
  });

  it("returns the requested count without repeats", () => {
    const result = sample([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4);
    expect(result).toHaveLength(4);
    expect(new Set(result).size).toBe(4);
  });

  it("gives every item a roughly equal chance of being shortlisted", () => {
    // The wheel shows a sample of a big pool, so a biased sample would quietly
    // make some watchlist titles unpickable.
    const pool = Array.from({ length: 20 }, (_, index) => index);
    const counts = new Array(20).fill(0);
    const runs = 8000;
    const size = 5;

    for (let i = 0; i < runs; i += 1) {
      for (const value of sample(pool, size)) counts[value] += 1;
    }

    const expected = (runs * size) / pool.length;
    for (const count of counts) {
      expect(Math.abs(count - expected) / expected).toBeLessThan(0.15);
    }
  });
});
