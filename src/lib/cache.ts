interface Entry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Small in-process TTL cache. Keeps repeat spins on the same title from
 * re-hitting OMDb/TMDB, which both have request budgets worth respecting.
 * Serverless instances are short-lived, so this is a best-effort speedup.
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, Entry<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 500,
  ) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    // Refresh insertion order so eviction stays roughly least-recently-used.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }
}
