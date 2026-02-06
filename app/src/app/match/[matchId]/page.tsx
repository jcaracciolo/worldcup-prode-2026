import Header from "@/components/Header";
import { createClient } from "@/lib/supabase/server";
import { getMatchInfo } from "@/lib/tournament";
import { buildApiToFifaMapping } from "@/lib/api-client";
import { calculateGroupStagePoints, calculateKnockoutPoints } from "@/lib/scoring";
import { isGroupStageMatch } from "@/lib/football-api";
import { Match } from "@/types/football";
import { notFound } from "next/navigation";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ matchId: string }>;
}

export default async function MatchDetailPage({ params }: PageProps) {
  const { matchId } = await params;
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let profile = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  // Get all matches from our centralized API
  let matches: Match[] = [];
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/matches`,
      { cache: "no-store" }
    );
    const data = await res.json();
    matches = data.matches || [];
  } catch (error) {
    console.error("Failed to fetch matches:", error);
  }

  // Find the specific match
  const match = matches.find((m) => m.id === parseInt(matchId));
  if (!match) {
    notFound();
  }

  // Build FIFA number mapping to get venue from tournament.ts
  const apiToFifaMap = buildApiToFifaMapping(matches);
  const fifaNumber = apiToFifaMap.get(match.id);
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

  const stageDisplay = formatGroupName(match.group) || formatStageName(match.stage);

  // Get user's prediction for this match
  let prediction = null;
  if (user) {
    const { data } = await supabase
      .from("predictions")
      .select("*")
      .eq("user_id", user.id)
      .eq("match_id", matchId)
      .single();
    prediction = data;
  }

  const isLive = match.status === "IN_PLAY" || match.status === "PAUSED";
  const isFinished = match.status === "FINISHED";
  const matchDate = new Date(match.utcDate);

  // Calculate points for this match using centralized scoring
  let pointsEarned = 0;
  const pointsBreakdown: string[] = [];

  if (isFinished && prediction) {
    // Use centralized scoring functions
    const breakdown = isGroupStageMatch(match)
      ? calculateGroupStagePoints(match, prediction)
      : calculateKnockoutPoints(match, prediction);

    pointsEarned = breakdown.reduce((sum, p) => sum + p.points, 0);
    
    // Build breakdown descriptions
    breakdown.forEach((p) => {
      pointsBreakdown.push(`+${p.points} ${p.description}`);
    });
  }

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
  const isGroupStage = match.stage === "GROUP_STAGE";

  // Highlight calculation for actual result
  const homeHighlight = homeWon || (isDraw && isGroupStage);
  const awayHighlight = awayWon || (isDraw && isGroupStage);

  // Prediction winner calculation
  const predHomeGoals = prediction?.home_goals ?? null;
  const predAwayGoals = prediction?.away_goals ?? null;
  const predHasScore = predHomeGoals !== null && predAwayGoals !== null;
  const predHomeWins = predHasScore && predHomeGoals > predAwayGoals;
  const predAwayWins = predHasScore && predAwayGoals > predHomeGoals;
  const predIsDraw = predHasScore && predHomeGoals === predAwayGoals;
  // For knockout ties, check winner_id to determine winner
  const isKnockout = !isGroupStage;
  const predHomeHighlight =
    predHomeWins ||
    (predIsDraw && isGroupStage) ||
    (predIsDraw && isKnockout && prediction?.winner_id === match.homeTeam.id);
  const predAwayHighlight =
    predAwayWins ||
    (predIsDraw && isGroupStage) ||
    (predIsDraw && isKnockout && prediction?.winner_id === match.awayTeam.id);

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={profile} />

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Match Header */}
          <div className="glass-card overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-green-600 text-white p-8">
              <div className="flex items-center justify-center gap-8">
                {/* Home Team */}
                <div
                  className={`text-center flex-1 p-3 rounded-xl ${homeHighlight ? "bg-amber-500/80" : ""} ${awayWon ? "opacity-50" : ""}`}
                >
                  {match.homeTeam.crest ? (
                    <img
                      src={match.homeTeam.crest}
                      alt={match.homeTeam.name}
                      className="w-20 h-20 mx-auto object-contain mb-3 drop-shadow-lg"
                    />
                  ) : (
                    <div className="w-20 h-20 mx-auto bg-white/20 rounded-full flex items-center justify-center mb-3">
                      <span className="text-2xl font-bold">
                        {match.homeTeam.tla}
                      </span>
                    </div>
                  )}
                  <div
                    className={`font-bold text-lg ${homeHighlight ? "text-slate-900" : ""}`}
                  >
                    {match.homeTeam.name}
                  </div>
                </div>

                {/* Score */}
                <div className="text-center min-w-[140px]">
                  {isFinished || isLive ? (
                    <div className="text-5xl font-bold">
                      {match.score.fullTime.home} - {match.score.fullTime.away}
                    </div>
                  ) : (
                    <div className="text-3xl font-light text-white/60">vs</div>
                  )}
                  <div className="mt-3">
                    {isLive ? (
                      <span className="px-4 py-1.5 bg-red-500 rounded-full text-sm font-semibold live-pulse">
                        LIVE
                      </span>
                    ) : isFinished ? (
                      <span className="px-4 py-1.5 bg-white/20 rounded-full text-sm font-semibold">
                        FULL TIME
                      </span>
                    ) : (
                      <span className="text-emerald-200 text-xl font-bold">
                        {format(matchDate, "HH:mm")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Away Team */}
                <div
                  className={`text-center flex-1 p-3 rounded-xl ${awayHighlight ? "bg-amber-500/80" : ""} ${homeWon ? "opacity-50" : ""}`}
                >
                  {match.awayTeam.crest ? (
                    <img
                      src={match.awayTeam.crest}
                      alt={match.awayTeam.name}
                      className="w-20 h-20 mx-auto object-contain mb-3 drop-shadow-lg"
                    />
                  ) : (
                    <div className="w-20 h-20 mx-auto bg-white/20 rounded-full flex items-center justify-center mb-3">
                      <span className="text-2xl font-bold">
                        {match.awayTeam.tla}
                      </span>
                    </div>
                  )}
                  <div
                    className={`font-bold text-lg ${awayHighlight ? "text-slate-900" : ""}`}
                  >
                    {match.awayTeam.name}
                  </div>
                </div>
              </div>
            </div>

            {/* Match Info */}
            <div className="p-6 space-y-4 bg-white/5">
              <div className="flex items-center gap-3 text-white/70">
                <span className="text-xl">📅</span>
                <span>{format(matchDate, "EEEE, MMMM d, yyyy - h:mm a")}</span>
              </div>

              {venueDisplay && (
                <div className="flex items-center gap-3 text-white/70">
                  <span className="text-xl">📍</span>
                  <span>{venueDisplay}</span>
                </div>
              )}

              <div className="flex items-center gap-3 text-white/70">
                <span className="text-xl">🏆</span>
                <span>
                  {stageDisplay} - Matchday {match.matchday}
                </span>
              </div>
            </div>

            {/* User's Prediction & Points */}
            {user && prediction && (
              <div className="border-t border-white/10 p-6">
                <h3 className="font-bold text-lg mb-4 text-white">
                  Your Prediction
                </h3>

                <div className="bg-white/10 rounded-xl p-5">
                  <div className="flex items-center justify-center gap-4 text-xl font-bold mb-4 text-white">
                    <span
                      className={`px-3 py-1 rounded-lg ${predHomeHighlight ? "bg-amber-500/80 text-slate-900" : ""}`}
                    >
                      {match.homeTeam.tla}
                    </span>
                    <span className="px-5 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-xl">
                      {prediction.home_goals ?? "-"} -{" "}
                      {prediction.away_goals ?? "-"}
                    </span>
                    <span
                      className={`px-3 py-1 rounded-lg ${predAwayHighlight ? "bg-amber-500/80 text-slate-900" : ""}`}
                    >
                      {match.awayTeam.tla}
                    </span>
                  </div>

                  {isFinished && (
                    <div className="border-t border-white/10 pt-4 mt-4">
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-medium text-white/70">
                          Points Earned
                        </span>
                        <span className="text-2xl font-bold text-emerald-400">
                          {pointsEarned} / 4
                        </span>
                      </div>
                      {pointsBreakdown.length > 0 ? (
                        <ul className="text-sm space-y-2">
                          {pointsBreakdown.map((item, i) => (
                            <li
                              key={i}
                              className="text-emerald-400 flex items-center gap-2"
                            >
                              <span className="w-5 h-5 bg-emerald-500/20 rounded-full flex items-center justify-center text-xs">
                                ✓
                              </span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-white/40">
                          No points earned from this match
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {!user && (
              <div className="border-t border-white/10 p-6 text-center">
                <a
                  href="/login"
                  className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                >
                  Log in
                </a>{" "}
                <span className="text-white/50">
                  to see your prediction for this match
                </span>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-white/10 mt-auto">
        <div className="container mx-auto px-4 py-6 text-center">
          <p className="text-white/40 text-sm">
            WorldCupProde - FIFA World Cup 2026 Predictions
          </p>
        </div>
      </footer>
    </div>
  );
}
