"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useMatchPredictions } from "@/hooks/useMatchPredictions";
import { MatchPredictionsPanel } from "@/components/MatchPredictionsPanel";
import { getMatchInfo } from "@/lib/tournament";
import { formatGroupName, formatStageName } from "@/lib/format";
import { format } from "date-fns";
import { asFifaMatchId } from "@/types/football";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function MatchDetailPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  const fifaId = asFifaMatchId(parseInt(matchId));

  const {
    match,
    matchesLoading,
    predictions: allUserPredictions,
    loading: loadingAllPredictions,
    currentUserId,
  } = useMatchPredictions(fifaId);

  if (matchesLoading && !match) {
    return <LoadingSpinner />;
  }

  if (!match) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <div className="text-xl text-white/60">Match not found</div>
        <Link
          href="/fixtures"
          className="text-sky-400 hover:text-sky-300 text-sm"
        >
          ← Back to fixtures
        </Link>
      </div>
    );
  }

  // Get venue from tournament.ts using FIFA number
  const matchInfo = match.id ? getMatchInfo(match.id) : null;
  const venueDisplay = matchInfo
    ? `${matchInfo.venue.stadium}, ${matchInfo.venue.city}`
    : match.venue;

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
                {match.id && (
                  <span className="text-xs px-2 py-0.5 bg-blue-500/30 rounded text-blue-300 font-mono">
                    #{match.id}
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
                        alt={match.homeDisplayName}
                        className="w-12 h-12 sm:w-16 sm:h-16 mx-auto object-contain mb-2 drop-shadow-lg"
                      />
                    ) : (
                      <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto bg-white/20 rounded-full flex items-center justify-center mb-2">
                        <span className="text-lg sm:text-xl font-bold">
                          {match.homeDisplayName}
                        </span>
                      </div>
                    )}
                    <div
                      className={`font-bold text-sm ${homeHighlight ? "text-slate-900" : "text-white"}`}
                    >
                      <span className="hidden sm:inline">
                        {match.homeTeam.name || match.homeDisplayName}
                      </span>
                      <span className="sm:hidden">{match.homeDisplayName}</span>
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
                        alt={match.awayDisplayName}
                        className="w-12 h-12 sm:w-16 sm:h-16 mx-auto object-contain mb-2 drop-shadow-lg"
                      />
                    ) : (
                      <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto bg-white/20 rounded-full flex items-center justify-center mb-2">
                        <span className="text-lg sm:text-xl font-bold">
                          {match.awayDisplayName}
                        </span>
                      </div>
                    )}
                    <div
                      className={`font-bold text-sm ${awayHighlight ? "text-slate-900" : "text-white"}`}
                    >
                      <span className="hidden sm:inline">
                        {match.awayTeam.name || match.awayDisplayName}
                      </span>
                      <span className="sm:hidden">{match.awayDisplayName}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Predictions Panel */}
                <MatchPredictionsPanel
                  match={match}
                  predictions={allUserPredictions}
                  loading={loadingAllPredictions}
                  currentUserId={currentUserId}
                />
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
