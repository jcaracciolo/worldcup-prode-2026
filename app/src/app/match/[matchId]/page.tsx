"use client";

import { useParams } from "next/navigation";
import { useMemo } from "react";
import Link from "next/link";
import { useMatches, useMatch } from "@/contexts/MatchContext";
import { useUser, useAllProfiles } from "@/contexts/UserContext";
import { useAllPredictions } from "@/contexts/PredictionsContext";
import { useMatchPointsForAllUsers } from "@/contexts/LeaderboardContext";
import { getMatchInfo } from "@/lib/tournament";
import { getMaxPossiblePoints } from "@/lib/scoring";
import { getTeamDisplaySimple } from "@/lib/team-display";
import { format } from "date-fns";
import { Profile } from "@/types/database";
import { FifaMatchId, asFifaMatchId } from "@/types/football";
import LoadingSpinner from "@/components/LoadingSpinner";

interface UserMatchPrediction {
  userId: string;
  displayName: string;
  homeGoals: number | null;
  awayGoals: number | null;
  winnerId: number | null;
  pointsEarned: number;
  maxPoints: number;
}

export default function MatchDetailPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  const { user: profile } = useUser();
  const profiles = useAllProfiles();
  const allPredictions = useAllPredictions();

  const { loading: matchesLoading } = useMatches();
  const fifaId = asFifaMatchId(parseInt(matchId));

  // Get match with resolved knockout teams baked in
  const match = useMatch(fifaId);

  // match.id IS the FIFA number
  const fifaNumber = match ? (match.id as FifaMatchId) : undefined;
  const matchIdNum = parseInt(matchId);

  const { matchPoints } = useMatchPointsForAllUsers(matchIdNum);
  const loadingAllPredictions = profiles.loading || allPredictions.loading;

  // Combine predictions with centrally calculated points
  const allUserPredictions = useMemo(() => {
    if (!match || !fifaNumber) return [];
    if (!profiles.content || !allPredictions.content) return [];

    const profilesList = profiles.content;
    const allPredictionsMap = allPredictions.content;

    const maxPoints = getMaxPossiblePoints(match);

    // Build a map of userId -> points from centralized calculation
    const pointsByUser = new Map<string, number>();
    matchPoints.forEach((mp) => {
      pointsByUser.set(mp.userId, mp.pointsEarned);
    });

    const userPredictions: UserMatchPrediction[] = [];

    profilesList.forEach((profileData: Profile) => {
      const userData = allPredictionsMap.get(profileData.id);
      if (!userData) return;

      // Find prediction for this match
      const pred = userData.predictions.find(
        (p) => (p.match_id as FifaMatchId) === fifaNumber,
      );

      if (!pred) return;

      // Get points from centralized calculation (already handles knockout team matching)
      const pointsEarned = pointsByUser.get(profileData.id) || 0;

      userPredictions.push({
        userId: profileData.id,
        displayName: profileData.display_name,
        homeGoals: pred.home_goals,
        awayGoals: pred.away_goals,
        winnerId: pred.winner_id,
        pointsEarned,
        maxPoints,
      });
    });

    // Sort: current user first, then by points (highest first), then by name
    userPredictions.sort((a, b) => {
      // Current user always first
      if (a.userId === profile?.id) return -1;
      if (b.userId === profile?.id) return 1;
      // Then sort by points
      if (b.pointsEarned !== a.pointsEarned)
        return b.pointsEarned - a.pointsEarned;
      return a.displayName.localeCompare(b.displayName);
    });

    return userPredictions;
  }, [
    match,
    fifaNumber,
    profiles.content,
    allPredictions.content,
    matchPoints,
    profile?.id,
  ]);

  if (matchesLoading && !match) {
    return <LoadingSpinner />;
  }

  if (!match) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-white/60">Match not found</div>
      </div>
    );
  }

  // Get venue from tournament.ts using FIFA number
  const matchInfo = fifaNumber ? getMatchInfo(fifaNumber) : null;
  const venueDisplay = matchInfo
    ? `${matchInfo.venue.stadium}, ${matchInfo.venue.city}`
    : match.venue;

  // Format group name: GROUP_A -> Group A
  const formatGroupName = (group: string | null): string | null => {
    if (!group) return null;
    if (group.startsWith("GROUP_")) {
      return `Group ${group.replace("GROUP_", "")}`;
    }
    return group;
  };

  // Format stage name for display
  const formatStageName = (stage: string): string => {
    const stageNames: Record<string, string> = {
      GROUP_STAGE: "Group Stage",
      LAST_32: "Round of 32",
      LAST_16: "Round of 16",
      QUARTER_FINALS: "Quarter-Finals",
      SEMI_FINALS: "Semi-Finals",
      THIRD_PLACE: "3rd Place",
      FINAL: "Final",
    };
    return stageNames[stage] || stage.replace(/_/g, " ");
  };

  const stageDisplay =
    formatGroupName(match.group) || formatStageName(match.stage);

  const isLive = match.status === "IN_PLAY" || match.status === "PAUSED";
  const isFinished = match.status === "FINISHED";
  const matchDate = new Date(match.utcDate);
  const isGroupStage = match.stage === "GROUP_STAGE";

  // Determine winner
  const homeGoals = match.score.fullTime.home;
  const awayGoals = match.score.fullTime.away;
  const homeWon =
    isFinished &&
    homeGoals !== null &&
    awayGoals !== null &&
    homeGoals > awayGoals;
  const awayWon =
    isFinished &&
    homeGoals !== null &&
    awayGoals !== null &&
    awayGoals > homeGoals;
  const isDraw =
    isFinished &&
    homeGoals !== null &&
    awayGoals !== null &&
    homeGoals === awayGoals;

  // Highlight calculation for actual result
  const homeHighlight = homeWon || (isDraw && isGroupStage);
  const awayHighlight = awayWon || (isDraw && isGroupStage);

  // Prediction highlighting helper
  const getPredictionHighlight = (pred: UserMatchPrediction) => {
    const predHasScore = pred.homeGoals !== null && pred.awayGoals !== null;
    if (!predHasScore) return { home: false, away: false };

    const predHomeWins = pred.homeGoals! > pred.awayGoals!;
    const predAwayWins = pred.awayGoals! > pred.homeGoals!;
    const predIsDraw = pred.homeGoals === pred.awayGoals;
    const isKnockout = !isGroupStage;

    const homeHighlight =
      predHomeWins ||
      (predIsDraw && isGroupStage) ||
      (predIsDraw && isKnockout && pred.winnerId === match.homeTeam.id);
    const awayHighlight =
      predAwayWins ||
      (predIsDraw && isGroupStage) ||
      (predIsDraw && isKnockout && pred.winnerId === match.awayTeam.id);

    return { home: homeHighlight, away: awayHighlight };
  };

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-4 sm:py-8">
        <div className="max-w-4xl mx-auto">
          {/* Match Header Card */}
          <div className="glass-card overflow-hidden mb-6">
            {/* Stage Badge */}
            <div className="bg-gradient-to-r from-slate-700/80 to-slate-600/80 px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🏆</span>
                <span className="text-white font-semibold">{stageDisplay}</span>
                {fifaNumber && (
                  <span className="text-xs px-2 py-0.5 bg-blue-500/30 rounded text-blue-300 font-mono">
                    #{fifaNumber}
                  </span>
                )}
              </div>
              {isLive && (
                <span className="px-3 py-1 bg-red-500 rounded-full text-xs font-bold text-white live-pulse">
                  LIVE
                </span>
              )}
              {isFinished && (
                <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-semibold text-white/80">
                  FINAL
                </span>
              )}
            </div>

            {/* Teams, Score, and Predictions */}
            <div className="bg-gradient-to-r from-emerald-600 to-green-600 p-4 sm:p-6">
              <div className="flex flex-col lg:flex-row lg:items-stretch gap-4 lg:gap-6">
                {/* Left: Teams and Score */}
                <div className="flex items-center justify-between gap-2 sm:gap-4 flex-1">
                  {/* Home Team */}
                  <div
                    className={`text-center flex-1 p-2 sm:p-4 rounded-xl transition-all ${homeHighlight ? "bg-amber-500/80" : ""} ${awayWon ? "opacity-60" : ""}`}
                  >
                    {match.homeTeam.crest ? (
                      <img
                        src={match.homeTeam.crest}
                        alt={
                          getTeamDisplaySimple(
                            match.homeTeam,
                            match.id,
                            "home",
                            fifaId,
                          ).label
                        }
                        className="w-12 h-12 sm:w-16 sm:h-16 mx-auto object-contain mb-2 drop-shadow-lg"
                      />
                    ) : (
                      <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto bg-white/20 rounded-full flex items-center justify-center mb-2">
                        <span className="text-lg sm:text-xl font-bold">
                          {
                            getTeamDisplaySimple(
                              match.homeTeam,
                              match.id,
                              "home",
                              fifaId,
                            ).label
                          }
                        </span>
                      </div>
                    )}
                    <div
                      className={`font-bold text-sm ${homeHighlight ? "text-slate-900" : "text-white"}`}
                    >
                      <span className="hidden sm:inline">
                        {match.homeTeam.name ||
                          getTeamDisplaySimple(
                            match.homeTeam,
                            match.id,
                            "home",
                            fifaId,
                          ).label}
                      </span>
                      <span className="sm:hidden">
                        {
                          getTeamDisplaySimple(
                            match.homeTeam,
                            match.id,
                            "home",
                            fifaId,
                          ).label
                        }
                      </span>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="text-center min-w-[80px] sm:min-w-[120px]">
                    {isFinished || isLive ? (
                      <div className="text-3xl sm:text-4xl font-bold text-white">
                        {match.score.fullTime.home} -{" "}
                        {match.score.fullTime.away}
                      </div>
                    ) : (
                      <div className="text-xl sm:text-2xl font-light text-white/60">
                        vs
                      </div>
                    )}
                    {!isFinished && !isLive && (
                      <div className="mt-1 text-emerald-200 text-base sm:text-lg font-bold">
                        {format(matchDate, "HH:mm")}
                      </div>
                    )}
                  </div>

                  {/* Away Team */}
                  <div
                    className={`text-center flex-1 p-2 sm:p-4 rounded-xl transition-all ${awayHighlight ? "bg-amber-500/80" : ""} ${homeWon ? "opacity-60" : ""}`}
                  >
                    {match.awayTeam.crest ? (
                      <img
                        src={match.awayTeam.crest}
                        alt={
                          getTeamDisplaySimple(
                            match.awayTeam,
                            match.id,
                            "away",
                            fifaId,
                          ).label
                        }
                        className="w-12 h-12 sm:w-16 sm:h-16 mx-auto object-contain mb-2 drop-shadow-lg"
                      />
                    ) : (
                      <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto bg-white/20 rounded-full flex items-center justify-center mb-2">
                        <span className="text-lg sm:text-xl font-bold">
                          {
                            getTeamDisplaySimple(
                              match.awayTeam,
                              match.id,
                              "away",
                              fifaId,
                            ).label
                          }
                        </span>
                      </div>
                    )}
                    <div
                      className={`font-bold text-sm ${awayHighlight ? "text-slate-900" : "text-white"}`}
                    >
                      <span className="hidden sm:inline">
                        {match.awayTeam.name ||
                          getTeamDisplaySimple(
                            match.awayTeam,
                            match.id,
                            "away",
                            fifaId,
                          ).label}
                      </span>
                      <span className="sm:hidden">
                        {
                          getTeamDisplaySimple(
                            match.awayTeam,
                            match.id,
                            "away",
                            fifaId,
                          ).label
                        }
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Predictions Panel */}
                <div className="lg:w-56 xl:w-64 bg-slate-900/70 rounded-xl p-3 backdrop-blur-sm border border-white/10">
                  <div className="text-xs font-semibold text-white/80 mb-2 flex items-center gap-1.5">
                    <span>👥</span>
                    <span>Predictions</span>
                    {allUserPredictions.length > 0 && (
                      <span className="text-white/50">
                        ({allUserPredictions.length})
                      </span>
                    )}
                  </div>

                  {loadingAllPredictions ? (
                    <div className="text-xs text-white/50 text-center py-2">
                      <span className="text-lg animate-bounce-spin inline-block">⚽</span>
                    </div>
                  ) : allUserPredictions.length === 0 ? (
                    <div className="text-xs text-white/50 text-center py-2">
                      No predictions yet
                    </div>
                  ) : (
                    <div className="space-y-1 max-h-[140px] overflow-y-auto">
                      {allUserPredictions.map((pred) => {
                        const highlight = getPredictionHighlight(pred);
                        const isCurrentUser = profile?.id === pred.userId;

                        return (
                          <Link
                            key={pred.userId}
                            href={`/user/${pred.userId}`}
                            className={`flex items-center justify-between gap-1.5 px-2 py-1 rounded-lg text-xs transition-all hover:bg-white/10 ${isCurrentUser ? "bg-sky-500/20 border border-sky-400/40" : ""}`}
                          >
                            <span
                              className={`truncate flex-1 ${isCurrentUser ? "text-sky-200 font-medium" : "text-white/90"}`}
                            >
                              {pred.displayName}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <span
                                className={`px-1 rounded ${highlight.home ? "bg-amber-400 text-slate-900 font-bold" : "text-white/70"}`}
                              >
                                {pred.homeGoals ?? "-"}
                              </span>
                              <span className="text-white/40">-</span>
                              <span
                                className={`px-1 rounded ${highlight.away ? "bg-amber-400 text-slate-900 font-bold" : "text-white/70"}`}
                              >
                                {pred.awayGoals ?? "-"}
                              </span>
                              {(isFinished || isLive) && (
                                <span
                                  className={`ml-1 font-bold ${pred.pointsEarned > 0 ? "text-sky-300" : "text-white/30"} ${isLive ? "live-pulse" : ""}`}
                                >
                                  +{pred.pointsEarned}
                                </span>
                              )}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {!profile && allUserPredictions.length > 0 && (
                    <Link
                      href="/login"
                      className="block text-center text-xs text-sky-300 hover:text-sky-200 mt-2"
                    >
                      Log in to highlight yours
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Match Details */}
            <div className="p-4 sm:p-6 bg-white/5 space-y-3 text-sm sm:text-base">
              <div className="flex items-center gap-3 text-white/70">
                <span className="text-lg">📅</span>
                <span className="hidden sm:inline">
                  {format(matchDate, "EEEE, MMMM d, yyyy - h:mm a")}
                </span>
                <span className="sm:hidden">
                  {format(matchDate, "EEE, MMM d - h:mm a")}
                </span>
              </div>

              {venueDisplay && (
                <div className="flex items-center gap-3 text-white/70">
                  <span className="text-lg">📍</span>
                  <span>{venueDisplay}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
