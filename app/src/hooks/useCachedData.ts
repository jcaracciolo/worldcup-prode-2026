/**
 * Generic keyed cache hook with automatic invalidation.
 *
 * Provides a Map-based cache with an optional bulk slot, in-flight fetch
 * deduplication, and a generation counter that auto-increments when the
 * `invalidateOn` dependency changes (e.g., competition switch).
 *
 * Consumers use `isCurrentGeneration(gen)` to guard against stale writes
 * from in-flight fetches that started before an invalidation.
 */

import { useRef, useState, useCallback, useEffect, useMemo } from "react";

export interface CachedDataResult<K, V, Bulk = unknown> {
  // Keyed cache operations
  get: (key: K) => V | undefined;
  has: (key: K) => boolean;
  set: (key: K, value: V) => void;
  update: (key: K, updater: (prev: V | undefined) => V) => void;
  deleteKey: (key: K) => void;
  clear: () => void;

  // Bulk cache (e.g., "all users" result)
  bulk: {
    get: () => Bulk | null;
    set: (value: Bulk) => void;
    clear: () => void;
  };

  // In-flight fetch deduplication
  fetching: {
    has: (key: K) => boolean;
    /** Returns false if already fetching (caller should skip) */
    start: (key: K) => boolean;
    done: (key: K) => void;
    clear: () => void;
  };

  /** Increments on any mutation — subscribe to trigger re-renders */
  version: number;

  /** Increments on invalidation (dependency change) */
  generation: number;

  /** Check if a captured generation is still current (guards stale writes) */
  isCurrentGeneration: (gen: number) => boolean;
}

export function useCachedData<K extends string | number, V, Bulk = unknown>(
  invalidateOn: unknown,
): CachedDataResult<K, V, Bulk> {
  const cacheRef = useRef(new Map<K, V>());
  const bulkRef = useRef<{ key: unknown; data: Bulk } | null>(null);
  const fetchingRef = useRef(new Set<K>());
  const generationRef = useRef(0);
  const invalidateOnRef = useRef(invalidateOn);
  invalidateOnRef.current = invalidateOn;
  const [version, setVersion] = useState(0);

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  // Invalidate all caches when dependency changes
  useEffect(() => {
    generationRef.current += 1;
    cacheRef.current.clear();
    bulkRef.current = null;
    fetchingRef.current.clear();
    bump();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalidateOn]);

  // --- Keyed cache ---
  const get = useCallback((key: K) => cacheRef.current.get(key), []);
  const has = useCallback((key: K) => cacheRef.current.has(key), []);

  const set = useCallback(
    (key: K, value: V) => {
      cacheRef.current.set(key, value);
      bump();
    },
    [bump],
  );

  const update = useCallback(
    (key: K, updater: (prev: V | undefined) => V) => {
      const prev = cacheRef.current.get(key);
      cacheRef.current.set(key, updater(prev));
      bump();
    },
    [bump],
  );

  const deleteKey = useCallback(
    (key: K) => {
      cacheRef.current.delete(key);
      bump();
    },
    [bump],
  );

  const clear = useCallback(() => {
    cacheRef.current.clear();
    bump();
  }, [bump]);

  // --- Bulk cache (tagged with invalidateOn key for synchronous staleness check) ---
  const bulkGet = useCallback(() => {
    const entry = bulkRef.current;
    if (!entry) return null;
    // Synchronous staleness guard: only return if data was stored
    // under the current invalidateOn value (e.g., same competition)
    if (entry.key !== invalidateOnRef.current) return null;
    return entry.data;
  }, []);
  const bulkSet = useCallback(
    (value: Bulk) => {
      bulkRef.current = { key: invalidateOnRef.current, data: value };
      bump();
    },
    [bump],
  );
  const bulkClear = useCallback(() => {
    bulkRef.current = null;
    bump();
  }, [bump]);

  // --- Fetching dedup ---
  const fetchingHas = useCallback((key: K) => fetchingRef.current.has(key), []);
  const fetchingStart = useCallback((key: K) => {
    if (fetchingRef.current.has(key)) return false;
    fetchingRef.current.add(key);
    return true;
  }, []);
  const fetchingDone = useCallback(
    (key: K) => fetchingRef.current.delete(key),
    [],
  );
  const fetchingClear = useCallback(() => fetchingRef.current.clear(), []);

  // --- Generation ---
  const isCurrentGeneration = useCallback(
    (gen: number) => gen === generationRef.current,
    [],
  );

  // Memoize the result object so consumers get a stable reference.
  // Callbacks are all stable (empty or [bump] deps), so this object
  // only changes when version changes. Consumers should depend on
  // individual callbacks (cache.get, cache.set) rather than the whole object.
  return useMemo(
    (): CachedDataResult<K, V, Bulk> => ({
      get,
      has,
      set,
      update,
      deleteKey,
      clear,
      bulk: { get: bulkGet, set: bulkSet, clear: bulkClear },
      fetching: {
        has: fetchingHas,
        start: fetchingStart,
        done: fetchingDone,
        clear: fetchingClear,
      },
      version,
      generation: generationRef.current,
      isCurrentGeneration,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );
}
