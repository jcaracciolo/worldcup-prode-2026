/**
 * Loading-Content-Error (LCE) pattern for async data.
 * Use this type for hooks that fetch data asynchronously.
 */
export interface LCE<T> {
  loading: boolean;
  content: T | null;
  error: string | null;
}

/**
 * Helper to create a loading state.
 * Pass previous content to preserve stale data while revalidating.
 */
export const lceLoading = <T>(staleContent?: T | null): LCE<T> => ({
  loading: true,
  content: staleContent ?? null,
  error: null,
});

/**
 * Helper to create a content state
 */
export const lceContent = <T>(content: T): LCE<T> => ({
  loading: false,
  content,
  error: null,
});

/**
 * Helper to create an error state.
 * Pass previous content to preserve stale data when a refresh fails —
 * data should never disappear just because revalidation errored.
 */
export const lceError = <T>(error: string, staleContent?: T | null): LCE<T> => ({
  loading: false,
  content: staleContent ?? null,
  error,
});
