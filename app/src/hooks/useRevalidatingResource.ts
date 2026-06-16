/**
 * Stale-while-revalidate resource hook.
 *
 * Encapsulates the single guarantee every LCE consumer needs:
 *   **once data exists, it stays visible until newer data replaces it** —
 *   even while loading, and even if a revalidation fails.
 *
 * Consumers get an `LCE<T>` whose `content` never regresses to null while a
 * refresh is in flight. `loading` is purely informational; it never implies
 * the absence of data. This keeps loading transparent to the UI: when there
 * is content, just render it.
 *
 * Centralising this logic means no individual context can accidentally
 * reintroduce the "blank on reload" bug by forgetting to preserve stale data.
 */

import { useEffect, useRef, useState, DependencyList } from "react";
import { LCE, lceLoading, lceContent, lceError } from "@/types/lce";

interface RevalidatingResourceOptions<T> {
  /**
   * When false, the resource is inactive: no fetch runs and the state is
   * `disabledContent` with `loading: false`. Defaults to true.
   */
  enabled?: boolean;
  /** Content to expose while disabled (e.g. null for a missing id). */
  disabledContent?: T | null;
}

/**
 * @param fetcher   Async loader for fresh data. Throw to signal an error.
 * @param getCached Synchronous read of any already-cached value (or null).
 * @param deps      Effect dependencies — re-run the fetch when these change
 *                  (typically the memoised `fetcher`).
 */
export function useRevalidatingResource<T>(
  fetcher: () => Promise<T>,
  getCached: () => T | null,
  deps: DependencyList,
  options: RevalidatingResourceOptions<T> = {},
): LCE<T> {
  const { enabled = true, disabledContent = null } = options;

  const [state, setState] = useState<LCE<T>>(() => {
    if (!enabled) return lceContent(disabledContent as T);
    const cached = getCached();
    return cached != null ? lceContent(cached) : lceLoading<T>();
  });

  // Latest content, readable inside the effect without making it a dependency.
  const contentRef = useRef<T | null>(state.content);
  contentRef.current = state.content;

  useEffect(() => {
    if (!enabled) {
      setState(lceContent(disabledContent as T));
      return;
    }

    // Preserve whatever we can already show while we revalidate.
    const stale = getCached() ?? contentRef.current;
    setState((prev) =>
      stale != null
        ? { loading: true, content: stale, error: null }
        : prev.loading && prev.content == null
          ? prev
          : lceLoading<T>(),
    );

    let cancelled = false;
    fetcher()
      .then((content) => {
        if (!cancelled) setState(lceContent(content));
      })
      .catch((err) => {
        if (cancelled) return;
        // Keep stale content visible on failure — never blank out.
        setState(lceError<T>(err?.message ?? "Failed to load", stale));
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
