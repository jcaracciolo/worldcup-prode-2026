import Header from "@/components/Header";
import { createClient } from "@/lib/supabase/server";
import { getMatch } from "@/lib/football-api";
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

  // Get match
  const match = await getMatch(parseInt(matchId));
  if (!match) {
    notFound();
  }

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

  // Calculate points for this match
  let pointsEarned = 0;
  const pointsBreakdown: string[] = [];

  if (
    isFinished &&
    prediction &&
    prediction.home_goals !== null &&
    prediction.away_goals !== null
  ) {
    const actualHome = match.score.fullTime.home;
    const actualAway = match.score.fullTime.away;

    if (actualHome !== null && actualAway !== null) {
      const predictedResult =
        prediction.home_goals > prediction.away_goals
          ? "home"
          : prediction.away_goals > prediction.home_goals
            ? "away"
            : "draw";
      const actualResult =
        actualHome > actualAway
          ? "home"
          : actualAway > actualHome
            ? "away"
            : "draw";

      if (predictedResult === actualResult) {
        pointsEarned += 2;
        pointsBreakdown.push(
          `+2 Correct result (${actualResult === "home" ? match.homeTeam.tla + " win" : actualResult === "away" ? match.awayTeam.tla + " win" : "Draw"})`,
        );
      }

      if (prediction.home_goals === actualHome) {
        pointsEarned += 1;
        pointsBreakdown.push(
          `+1 Correct ${match.homeTeam.tla} goals (${actualHome})`,
        );
      }

      if (prediction.away_goals === actualAway) {
        pointsEarned += 1;
        pointsBreakdown.push(
          `+1 Correct ${match.awayTeam.tla} goals (${actualAway})`,
        );
      }
    }
  }

  // Determine winner
  const homeGoals = match.score.fullTime.home;
  const awayGoals = match.score.fullTime.away;
  const homeWon = isFinished && homeGoals !== null && awayGoals !== null && homeGoals > awayGoals;
  const awayWon = isFinished && homeGoals !== null && awayGoals !== null && awayGoals > homeGoals;

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
                <div className={`text-center flex-1 ${awayWon ? "opacity-50" : ""}`}>
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
                  <div className={`font-bold text-lg ${homeWon ? "text-yellow-300" : ""}`}>{match.homeTeam.name}</div>
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
                <div className={`text-center flex-1 ${homeWon ? "opacity-50" : ""}`}>
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
                  <div className={`font-bold text-lg ${awayWon ? "text-yellow-300" : ""}`}>{match.awayTeam.name}</div>
                </div>
              </div>
            </div>

            {/* Match Info */}
            <div className="p-6 space-y-4 bg-white/5">
              <div className="flex items-center gap-3 text-white/70">
                <span className="text-xl">📅</span>
                <span>{format(matchDate, "EEEE, MMMM d, yyyy - h:mm a")}</span>
              </div>

              {match.venue && (
                <div className="flex items-center gap-3 text-white/70">
                  <span className="text-xl">📍</span>
                  <span>{match.venue}</span>
                </div>
              )}

              <div className="flex items-center gap-3 text-white/70">
                <span className="text-xl">🏆</span>
                <span>
                  {match.group || match.stage.replace(/_/g, " ")} - Matchday{" "}
                  {match.matchday}
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
                    <span>{match.homeTeam.tla}</span>
                    <span className="px-5 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-xl">
                      {prediction.home_goals ?? "-"} -{" "}
                      {prediction.away_goals ?? "-"}
                    </span>
                    <span>{match.awayTeam.tla}</span>
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
