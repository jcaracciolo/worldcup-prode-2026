import Header from "@/components/Header";
import TodaysMatches from "@/components/TodaysMatches";
import Leaderboard from "@/components/Leaderboard";
import { createClient } from "@/lib/supabase/server";
import { UserScore } from "@/types/football";

export const dynamic = "force-dynamic";

async function getLeaderboard(): Promise<UserScore[]> {
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name");

  if (!profiles) return [];

  // For now, return profiles with 0 points
  // Full scoring calculation would be done here
  return profiles.map((profile) => ({
    userId: profile.id,
    displayName: profile.display_name,
    totalPoints: 0,
    groupStagePoints: 0,
    groupBonusPoints: 0,
    knockoutPoints: 0,
  }));
}

export default async function HomePage() {
  const supabase = await createClient();

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

  const leaderboard = await getLeaderboard();

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={profile} />

      <main className="flex-1 container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="glass-card p-8 mb-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            FIFA World Cup 2026
          </h1>
          <p className="text-emerald-100/80 text-lg max-w-2xl mx-auto">
            Make your predictions for every match, climb the leaderboard, and
            compete with friends!
          </p>
          {!user && (
            <div className="mt-6">
              <a
                href="/signup"
                className="inline-block px-8 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold rounded-xl hover:from-emerald-400 hover:to-green-500 transition-all shadow-lg shadow-green-500/30 hover:shadow-green-500/50"
              >
                Start Predicting →
              </a>
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Matches Section */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                <span className="text-xl">📅</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Today&apos;s Matches</h2>
                <p className="text-white/50 text-sm">World Cup 2026</p>
              </div>
            </div>

            <TodaysMatches />
          </div>

          {/* Leaderboard Section */}
          <div className="lg:col-span-1">
            <Leaderboard scores={leaderboard} currentUserId={user?.id} />
          </div>
        </div>
      </main>

      <footer className="border-t border-white/10 mt-auto">
        <div className="container mx-auto px-4 py-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-2xl">⚽</span>
            <span className="text-lg font-bold text-white">WorldCupProde</span>
          </div>
          <p className="text-white/40 text-sm">
            FIFA World Cup 2026 Predictions
          </p>
          <p className="text-white/30 text-xs mt-1">
            Not a real betting application
          </p>
        </div>
      </footer>
    </div>
  );
}
