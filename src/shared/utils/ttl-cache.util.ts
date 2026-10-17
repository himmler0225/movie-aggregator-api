interface Entry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Small bounded in-memory TTL cache with in-flight de-duplication.
 * Failed loads are never cached, so an upstream outage is retried on the next call.
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, Entry<T>>();
  private readonly pending = new Map<string, Promise<T>>();

  constructor(
    private readonly maxEntries: number,
    private readonly now: () => number = Date.now,
  ) {}

  get size() {
    return this.entries.size;
  }

  async getOrLoad(
    key: string,
    ttlMs: number,
    load: () => Promise<T>,
  ): Promise<T> {
    const hit = this.entries.get(key);

    if (hit && hit.expiresAt > this.now()) {
      // Refresh recency so hot keys survive eviction.
      this.entries.delete(key);
      this.entries.set(key, hit);

      return hit.value;
    }

    if (hit) this.entries.delete(key);

    const inflight = this.pending.get(key);

    if (inflight) return inflight;

    const promise = load()
      .then((value) => {
        this.set(key, value, ttlMs);

        return value;
      })
      .finally(() => {
        this.pending.delete(key);
      });

    this.pending.set(key, promise);

    return promise;
  }

  clear() {
    this.entries.clear();
    this.pending.clear();
  }

  private set(key: string, value: T, ttlMs: number) {
    this.entries.set(key, { value, expiresAt: this.now() + ttlMs });

    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();

      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
  }
}
