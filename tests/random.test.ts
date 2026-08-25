import { describe, expect, it } from "vitest";
import { randomInt, shuffle } from "@/lib/random";

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
