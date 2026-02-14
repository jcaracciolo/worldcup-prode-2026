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
 * Helper to create a loading state
 */
export const lceLoading = <T>(): LCE<T> => ({
  loading: true,
  content: null,
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
 * Helper to create an error state
 */
export const lceError = <T>(error: string): LCE<T> => ({
  loading: false,
  content: null,
  error,
});
