"use client";

import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useCallback,
} from "react";
import { MatchWithLiveInfo, getMatchDay, useMatches } from "@/contexts/MatchContext";
import { useTime } from "@/contexts/TimeContext";

interface MatchDayNavValue {
  selectedDay: string | null;
  dayMatches: MatchWithLiveInfo[];
  isToday: boolean;
  canPrev: boolean;
  canNext: boolean;
  prev: () => void;
  next: () => void;
  goToday: () => void;
}

const MatchDayNavContext = createContext<MatchDayNavValue | null>(null);

/**
 * Provider that holds shared match-day navigation state.
 * Both TodaysMatches and TodaysPredictions consume this so their arrows stay in sync.
 */
export function MatchDayNavProvider({ children }: { children: React.ReactNode }) {
  const { matches } = useMatches();
  const { getCurrentTime } = useTime();
  const todayStr = getMatchDay(getCurrentTime());

  const allDays = useMemo(() => {
    const days = new Set<string>();
    for (const m of matches) {
      days.add(getMatchDay(new Date(m.utcDate)));
    }
    return [...days].sort();
  }, [matches]);

  const todayIndex = useMemo(() => {
    const exact = allDays.indexOf(todayStr);
    if (exact >= 0) return exact;
    const future = allDays.findIndex((d) => d > todayStr);
    return future >= 0 ? future : Math.max(allDays.length - 1, 0);
  }, [allDays, todayStr]);

  const [dayIndex, setDayIndex] = useState(todayIndex);

  useEffect(() => {
    setDayIndex(todayIndex);
  }, [todayIndex]);

  const clamped = Math.min(dayIndex, Math.max(allDays.length - 1, 0));
  const selectedDay = allDays[clamped] ?? null;

  const dayMatches = useMemo(() => {
    if (!selectedDay) return [];
    return matches
      .filter((m) => getMatchDay(new Date(m.utcDate)) === selectedDay)
      .sort(
        (a, b) =>
          new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
      );
  }, [matches, selectedDay]);

  const isToday = selectedDay === todayStr;
  const canPrev = clamped > 0;
  const canNext = clamped < allDays.length - 1;
  const prev = useCallback(() => setDayIndex((i) => Math.max(0, i - 1)), []);
  const next = useCallback(
    () => setDayIndex((i) => Math.min(allDays.length - 1, i + 1)),
    [allDays.length],
  );
  const goToday = useCallback(() => setDayIndex(todayIndex), [todayIndex]);

  const value = useMemo<MatchDayNavValue>(
    () => ({ selectedDay, dayMatches, isToday, canPrev, canNext, prev, next, goToday }),
    [selectedDay, dayMatches, isToday, canPrev, canNext, prev, next, goToday],
  );

  return (
    <MatchDayNavContext.Provider value={value}>
      {children}
    </MatchDayNavContext.Provider>
  );
}

/**
 * Hook to consume the shared match-day navigation state.
 */
export function useMatchDayNav(): MatchDayNavValue {
  const ctx = useContext(MatchDayNavContext);
  if (!ctx) throw new Error("useMatchDayNav must be used within MatchDayNavProvider");
  return ctx;
}
