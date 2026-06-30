"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { MatchWithLiveInfo } from "@/contexts/MatchContext";
import { useDatabase } from "@/contexts/DatabaseContext";
import { useAllPredictions } from "@/contexts/PredictionsContext";
import { useAllProfiles } from "@/contexts/UserContext";
import { useUser } from "@/contexts/UserContext";
import { useTime } from "@/contexts/TimeContext";
import { FifaMatchId } from "@/types/football";
import UserName from "@/components/UserName";
import Link from "next/link";
import { useMatchDayNav } from "@/hooks/useMatchDayNav";

/** Which team a tie-breaker prediction sends through, for the flag badge. */
type AdvanceSide = {
  side: "HOME" | "AWAY";
  tla: string;
  crest: string | null;
} | null;

interface GroupedPrediction {
  /** Unique key for React (score, plus advancer for knockout ties). */
  key: string;
  score: string;
  homeGoals: number;
  awayGoals: number;
  /** For knockout ties: the team this group predicted to advance (else null). */
  advance: AdvanceSide;
  users: { userId: string; name: string; country: string | null }[];
  /** True when this is the first item after a section boundary (ties, away wins) */
  sectionBreak: boolean;
}

/**
 * Group and sort predictions for a match, identical to admin Copy Predictions ordering:
 * home wins → ties → away wins, within each group sorted by winner goals desc.
 *
 * For knockout ties, predictions are further split by which team the user
 * predicted to advance on penalties (penalty_winner), so a "1-1 → home advances"
 * group is shown separately from "1-1 → away advances", each with a team flag.
 */
function groupPredictions(
  match: MatchWithLiveInfo,
  predictionsMap: Map<string, { predictions: { match_id: number; home_goals: number | null; away_goals: number | null; penalty_winner?: "HOME" | "AWAY" | null }[] }>,
  profileMap: Map<string, { name: string; country: string | null }>,
  currentUserId: string | null,
  isAdmin: boolean,
  othersVisible: boolean,
): GroupedPrediction[] {
  const isKnockout = match.stage !== "GROUP_STAGE";
  // Per-group key → { users, penalty_winner }. For knockout ties the key
  // embeds the advancer so the two sides land in separate rows.
  const grouped = new Map<
    string,
    {
      score: string;
      penaltyWinner: "HOME" | "AWAY" | null;
      users: { userId: string; name: string; country: string | null }[];
    }
  >();

  predictionsMap.forEach((userData, userId) => {
    const profile = profileMap.get(userId);
    if (!profile) return;

    // Visibility: before stage lock, only show own (admins see all)
    if (!othersVisible && !isAdmin && userId !== currentUserId) return;

    const pred = userData.predictions.find(
      (p) => p.match_id === (match.id as FifaMatchId),
    );
    if (!pred || pred.home_goals === null || pred.away_goals === null) return;

    const score = `${pred.home_goals}-${pred.away_goals}`;
    const isTie = pred.home_goals === pred.away_goals;
    const penaltyWinner =
      isKnockout && isTie ? pred.penalty_winner ?? null : null;
    // Knockout ties split by advancer; everything else keys on score alone.
    const key = penaltyWinner ? `${score}|${penaltyWinner}` : score;

    if (!grouped.has(key))
      grouped.set(key, { score, penaltyWinner, users: [] });
    grouped.get(key)!.users.push({ userId, name: profile.name, country: profile.country });
  });

  // Group by outcome
  const entries = [...grouped.values()];
  const homeWins = entries.filter((g) => {
    const [h, a] = g.score.split("-").map(Number);
    return h > a;
  });
  const ties = entries.filter((g) => {
    const [h, a] = g.score.split("-").map(Number);
    return h === a;
  });
  const awayWins = entries.filter((g) => {
    const [h, a] = g.score.split("-").map(Number);
    return h < a;
  });

  type Grp = (typeof entries)[number];

  // Home wins: highest home goals first, then lowest away goals
  const byHomeWins = (a: Grp, b: Grp) => {
    const [ah, aa] = a.score.split("-").map(Number);
    const [bh, ba] = b.score.split("-").map(Number);
    if (bh !== ah) return bh - ah;
    return aa - ba;
  };
  // Ties: highest goals first, then home-advancer before away-advancer
  const byTies = (a: Grp, b: Grp) => {
    const diff = Number(b.score.split("-")[0]) - Number(a.score.split("-")[0]);
    if (diff !== 0) return diff;
    const rank = (p: "HOME" | "AWAY" | null) =>
      p === "HOME" ? 0 : p === "AWAY" ? 1 : 2;
    return rank(a.penaltyWinner) - rank(b.penaltyWinner);
  };
  // Away wins: lowest away goals first (increasing down)
  const byAwayWins = (a: Grp, b: Grp) => {
    const [ah, aa] = a.score.split("-").map(Number);
    const [bh, ba] = b.score.split("-").map(Number);
    if (aa !== ba) return aa - ba;
    return bh - ah;
  };

  const homeWinsSorted = homeWins.sort(byHomeWins);
  const tiesSorted = ties.sort(byTies);
  const awayWinsSorted = awayWins.sort(byAwayWins);

  const advanceFor = (penaltyWinner: "HOME" | "AWAY" | null): AdvanceSide => {
    if (!penaltyWinner) return null;
    const team = penaltyWinner === "HOME" ? match.homeTeam : match.awayTeam;
    if (!team) return null;
    return {
      side: penaltyWinner,
      tla: team.tla || (penaltyWinner === "HOME" ? "HOME" : "AWAY"),
      crest: team.crest ?? null,
    };
  };

  const result: GroupedPrediction[] = [];

  const push = (g: Grp, sectionBreak: boolean) => {
    const [h, a] = g.score.split("-").map(Number);
    result.push({
      key: g.penaltyWinner ? `${g.score}|${g.penaltyWinner}` : g.score,
      score: g.score,
      homeGoals: h,
      awayGoals: a,
      advance: advanceFor(g.penaltyWinner),
      users: g.users.sort((x, y) => x.name.localeCompare(y.name)),
      sectionBreak,
    });
  };

  homeWinsSorted.forEach((g) => push(g, false));
  tiesSorted.forEach((g, i) => push(g, i === 0 && homeWinsSorted.length > 0));
  awayWinsSorted.forEach((g, i) =>
    push(g, i === 0 && (homeWinsSorted.length > 0 || tiesSorted.length > 0)),
  );

  return result;
}

export default function TodaysPredictions() {
  const { competitionLoading, currentCompetitionId } = useDatabase();
  const allPredictions = useAllPredictions();
  const profiles = useAllProfiles();
  const { user: profile } = useUser();
  const { stageLockStatus, isKnockoutMatchLocked } = useTime();
  const { selectedDay, dayMatches, isToday, canPrev, canNext, prev, next, goToday } =
    useMatchDayNav();

  const currentUserId = profile?.id ?? null;
  const isAdmin = profile?.is_admin === true;

  const profileMap = useMemo(() => {
    const map = new Map<string, { name: string; country: string | null }>();
    (profiles.content || []).forEach((p) =>
      map.set(p.id, { name: p.display_name, country: p.country }),
    );
    return map;
  }, [profiles.content]);

  const matchPredictions = useMemo(() => {
    if (!allPredictions.content || dayMatches.length === 0) return [];

    return dayMatches.map((match) => {
      const isGroupMatch = match.stage === "GROUP_STAGE";
      // Knockout predictions stay fully hidden (including the user's own) until
      // that match locks — per-match, so #73 reveals the day it kicks off while
      // the rest stay hidden until the deadline.
      const knockoutVisible = isKnockoutMatchLocked(match.utcDate);
      if (!isGroupMatch && !knockoutVisible) {
        return { match, groups: [] as ReturnType<typeof groupPredictions> };
      }

      const othersVisible = isGroupMatch
        ? stageLockStatus.groupStageLocked
        : knockoutVisible;

      const groups = groupPredictions(
        match,
        allPredictions.content!,
        profileMap,
        currentUserId,
        isAdmin,
        othersVisible,
      );

      return { match, groups };
    });
  }, [
    allPredictions.content,
    dayMatches,
    profileMap,
    currentUserId,
    isAdmin,
    stageLockStatus.groupStageLocked,
    isKnockoutMatchLocked,
  ]);

  // Only block rendering when there's truly no data (first load)
  if ((competitionLoading || !currentCompetitionId) && !allPredictions.content && !profiles.content) return null;
  if (!allPredictions.content && !profiles.content) return null;
  if (dayMatches.length === 0) return null;

  // If browsing an all-knockout day where NO match has locked yet, hide all
  // predictions with an explanatory message. Once any match locks (e.g. #73 on
  // its kickoff day), its predictions show and this banner is suppressed.
  const allKnockout = dayMatches.length > 0 && dayMatches.every((m) => m.stage !== "GROUP_STAGE");
  const knockoutHidden =
    allKnockout && dayMatches.every((m) => !isKnockoutMatchLocked(m.utcDate));

  const hasPredictions = !knockoutHidden && matchPredictions.some((mp) => mp.groups.length > 0);

  const formatDay = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00Z");
    return format(date, "EEEE, MMMM d");
  };

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-2 sm:gap-3">
        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-xl flex items-center justify-center">
          <span className="text-xl sm:text-2xl">🔮</span>
        </div>
        <div className="flex-1">
          <h2 className="text-lg sm:text-xl font-bold text-white">
            {isToday ? "Today's Predictions" : "Predictions"}
          </h2>
          <p className="text-purple-100 text-xs sm:text-sm">
            {isToday
              ? `${dayMatches.length} match${dayMatches.length !== 1 ? "es" : ""}`
              : formatDay(selectedDay!)}
          </p>
        </div>
        {!isToday && (
          <button
            onClick={goToday}
            className="px-2 py-1 rounded-lg text-xs text-white/80 hover:text-white bg-white/10 hover:bg-white/20 transition-colors"
          >
            Today
          </button>
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={prev}
            disabled={!canPrev}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/80 hover:text-white bg-white/10 hover:bg-white/20 transition-colors disabled:text-white/20 disabled:bg-white/5 disabled:hover:bg-white/5"
            aria-label="Previous match day"
          >
            ‹
          </button>
          <button
            onClick={next}
            disabled={!canNext}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/80 hover:text-white bg-white/10 hover:bg-white/20 transition-colors disabled:text-white/20 disabled:bg-white/5 disabled:hover:bg-white/5"
            aria-label="Next match day"
          >
            ›
          </button>
        </div>
      </div>

      {/* Content */}
      {!hasPredictions ? (
        <div className="p-6 sm:p-8 text-center">
          <div className="text-3xl sm:text-4xl mb-3">🔮</div>
          <p className="text-white/60 text-sm sm:text-base">
            {knockoutHidden
              ? "Knockout predictions are hidden until the stage locks"
              : "No predictions yet"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y-2 sm:divide-y-0 divide-white/15">
          {matchPredictions.map(({ match, groups }) => (
            <div key={match.id} className="px-4 sm:px-6 pb-3 sm:pb-4 sm:border-b-2 sm:border-white/15 sm:odd:border-r-2">
              {/* Match header */}
              <Link
                href={`/match/${match.id}`}
                className="flex items-center justify-center gap-2 sm:gap-3 mb-3 hover:opacity-80 transition-opacity bg-gradient-to-r from-purple-500/20 to-violet-500/20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2"
              >
                {/* Home team */}
                <div className="flex items-center gap-1.5">
                  {match.homeTeam?.crest && (
                    <img
                      src={match.homeTeam.crest}
                      alt={match.homeDisplayName}
                      className="w-4 h-4 sm:w-5 sm:h-5 object-contain"
                    />
                  )}
                  <span className="text-xs sm:text-sm font-semibold text-white">
                    {match.homeTeam?.tla || match.homeDisplayName}
                  </span>
                </div>

                <span className="text-white/40 text-xs">vs</span>

                {/* Away team */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm font-semibold text-white">
                    {match.awayTeam?.tla || match.awayDisplayName}
                  </span>
                  {match.awayTeam?.crest && (
                    <img
                      src={match.awayTeam.crest}
                      alt={match.awayDisplayName}
                      className="w-4 h-4 sm:w-5 sm:h-5 object-contain"
                    />
                  )}
                </div>

                <span className="text-white/30 text-[10px] sm:text-xs ml-1">
                  {format(new Date(match.utcDate), "HH:mm")}
                </span>
              </Link>

              {/* Grouped predictions */}
              {groups.length === 0 ? (
                <p className="text-white/30 text-xs text-center">
                  No predictions
                </p>
              ) : (
                <div className="space-y-2">
                  {groups.map(({ key, score, advance, users, sectionBreak }) => (
                    <div key={key}>
                      {sectionBreak && (
                        <div className="border-t border-white/10 my-2" />
                      )}
                      <div className="flex items-start gap-2 sm:gap-3">
                        {/* Score badge + (knockout tie) advancing-team flag */}
                        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 bg-white/10 rounded text-xs sm:text-sm font-bold text-white/90 text-center">
                          <span className="min-w-[28px] text-center">{score}</span>
                          {advance && (
                            <span
                              className="inline-flex items-center gap-0.5 pl-1 border-l border-white/15"
                              title={`Advances: ${advance.tla}`}
                            >
                              <span className="text-white/40 text-[10px]">→</span>
                              {advance.crest ? (
                                <img
                                  src={advance.crest}
                                  alt={advance.tla}
                                  className="w-3.5 h-3.5 object-contain"
                                />
                              ) : null}
                              <span className="text-[10px] text-white/70">
                                {advance.tla}
                              </span>
                            </span>
                          )}
                        </span>

                        {/* Users list */}
                        <div className="flex flex-wrap items-center gap-y-1 min-w-0">
                          {users.map((u, i) => (
                            <span key={u.userId} className="flex items-center">
                              {i > 0 && <span className="text-white/20 mx-1.5">·</span>}
                              <Link
                                href={`/user/${u.userId}`}
                                className={`text-xs sm:text-sm hover:text-white transition-colors ${
                                  u.userId === currentUserId
                                    ? "text-purple-300 font-medium"
                                    : "text-white/70"
                                }`}
                              >
                                <UserName name={u.name} country={u.country} />
                              </Link>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
