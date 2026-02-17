import { useCallback } from "react";

/**
 * Returns a memoized callback that scrolls the viewport to the first
 * element with the `.live-match` CSS class (set by MatchCard).
 */
export function useScrollToLiveMatch() {
  return useCallback(() => {
    const firstLiveMatch = document.querySelector(".live-match");
    if (firstLiveMatch) {
      firstLiveMatch.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);
}
