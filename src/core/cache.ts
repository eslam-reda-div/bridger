/**
 * Bridger — LRU Cache
 *
 * Time-bounded Least Recently Used cache for caching resolved
 * attribute values and reducing IPC roundtrips.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class LRUCache<T = unknown> {
  private readonly maxSize: number;
  private readonly ttl: number;
  private readonly store = new Map<string, CacheEntry<T>>();

  constructor(maxSize: number = 1000, ttl: number = 300_000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    // Delete first to update insertion order
    this.store.delete(key);

    // Evict oldest if at capacity
    if (this.store.size >= this.maxSize) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) {
        this.store.delete(oldest);
      }
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttl,
    });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /** Delete all entries matching a prefix */
  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}
