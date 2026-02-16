"use client";

/**
 * Animated football loading spinner.
 * Shows a bouncing/spinning football emoji with optional message.
 */
export default function LoadingSpinner({
  message = "Loading...",
}: {
  message?: string;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="text-4xl animate-bounce-spin">⚽</div>
        <p className="text-white/50 text-sm font-medium">{message}</p>
      </div>
    </div>
  );
}

/**
 * Inline loading spinner for sections within a page (not full screen).
 */
export function InlineLoadingSpinner({
  message = "Loading...",
}: {
  message?: string;
}) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex flex-col items-center gap-3">
        <div className="text-3xl animate-bounce-spin">⚽</div>
        <p className="text-white/50 text-sm font-medium">{message}</p>
      </div>
    </div>
  );
}
