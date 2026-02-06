"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import PredictionInput from "@/components/PredictionInput";
import StandingsTable from "@/components/StandingsTable";
import R32Preview from "@/components/R32Preview";
import { createClient } from "@/lib/supabase/client";
import { Match, CalculatedStanding, Team } from "@/types/football";
import { getQualifyingThirdPlaceTeams } from "@/lib/third-place-ranking";
import {
  Profile,
  Prediction,
  TournamentSettings,
  GroupStandingsOverride,
} from "@/types/database";

interface GroupData {
  name: string;
  matches: Match[];
  standings: CalculatedStanding[];
}

export default function PredictionsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<TournamentSettings | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Map<number, Prediction>>(
    new Map(),
  );
  const [overrides, setOverrides] = useState<GroupStandingsOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login?redirect=/predictions");
        return;
      }

      // Load profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      setProfile(profileData);

      // Load tournament settings
      const { data: settingsData } = await supabase
        .from("tournament_settings")
        .select("*")
        .single();
      setSettings(settingsData);

      // Load matches from API
      const matchesRes = await fetch("/api/matches");
      const matchesData = await matchesRes.json();
      setMatches(matchesData.matches || []);

      // Load user predictions
      const { data: predictionsData } = await supabase
        .from("predictions")
        .select("*")
        .eq("user_id", user.id);

      const predMap = new Map();
      (predictionsData as unknown as Prediction[] | null)?.forEach(
        (p: Prediction) => predMap.set(p.match_id, p),
      );
      setPredictions(predMap);

      // Load standing overrides
      const { data: overridesData } = await supabase
        .from("group_standings_overrides")
        .select("*")
        .eq("user_id", user.id);
      setOverrides(overridesData || []);

      setLoading(false);
    };

    loadData();
  }, [supabase, router]);

  const handlePredictionChange = (
    matchId: number,
    homeGoals: number | null,
    awayGoals: number | null,
    winnerId?: number | null,
  ) => {
    const existing = predictions.get(matchId);
    const updated: Prediction = {
      id: existing?.id || "",
      user_id: profile?.id || "",
      match_id: matchId,
      home_goals: homeGoals,
      away_goals: awayGoals,
      winner_id: winnerId ?? existing?.winner_id ?? null,
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setPredictions(new Map(predictions.set(matchId, updated)));
  };

  const calculateStandings = useCallback(
    (groupMatches: Match[], groupName?: string): CalculatedStanding[] => {
      const teamStats = new Map<number, CalculatedStanding>();

      // Initialize teams
      groupMatches.forEach((match) => {
        if (!teamStats.has(match.homeTeam.id)) {
          teamStats.set(match.homeTeam.id, createEmptyStanding(match.homeTeam));
        }
        if (!teamStats.has(match.awayTeam.id)) {
          teamStats.set(match.awayTeam.id, createEmptyStanding(match.awayTeam));
        }
      });

      // Calculate from predictions
      groupMatches.forEach((match) => {
        const prediction = predictions.get(match.id);
        if (
          !prediction ||
          prediction.home_goals === null ||
          prediction.away_goals === null
        )
          return;

        const homeStats = teamStats.get(match.homeTeam.id)!;
        const awayStats = teamStats.get(match.awayTeam.id)!;

        homeStats.played++;
        awayStats.played++;
        homeStats.goalsFor += prediction.home_goals;
        homeStats.goalsAgainst += prediction.away_goals;
        awayStats.goalsFor += prediction.away_goals;
        awayStats.goalsAgainst += prediction.home_goals;
        homeStats.goalDifference = homeStats.goalsFor - homeStats.goalsAgainst;
        awayStats.goalDifference = awayStats.goalsFor - awayStats.goalsAgainst;

        if (prediction.home_goals > prediction.away_goals) {
          homeStats.won++;
          homeStats.points += 3;
          awayStats.lost++;
        } else if (prediction.away_goals > prediction.home_goals) {
          awayStats.won++;
          awayStats.points += 3;
          homeStats.lost++;
        } else {
          homeStats.drawn++;
          awayStats.drawn++;
          homeStats.points += 1;
          awayStats.points += 1;
        }
      });

      let standings = Array.from(teamStats.values())
        .sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          if (b.goalDifference !== a.goalDifference)
            return b.goalDifference - a.goalDifference;
          return b.goalsFor - a.goalsFor;
        })
        .map((s, i) => ({ ...s, position: i + 1 }));

      // Apply manual position overrides for tiebreakers
      if (groupName) {
        const groupOverrides = overrides.filter(o => o.group_name === groupName);
        if (groupOverrides.length > 0) {
          // Sort by override positions
          standings = standings.map(s => {
            const override = groupOverrides.find(o => o.team_id === s.team.id);
            return { ...s, position: override?.position || s.position };
          }).sort((a, b) => a.position - b.position)
            .map((s, i) => ({ ...s, position: i + 1 }));
        }
      }

      return standings;
    },
    [predictions, overrides],
  );

  const handleSwapPositions = (groupName: string, teamId1: number, teamId2: number) => {
    // Find current positions
    const groupMatches = matches.filter(m => m.group === groupName);
    const standings = calculateStandings(groupMatches, groupName);
    
    const team1Standing = standings.find(s => s.team.id === teamId1);
    const team2Standing = standings.find(s => s.team.id === teamId2);
    
    if (!team1Standing || !team2Standing) return;
    
    // Create new overrides swapping positions
    const newOverrides = overrides.filter(
      o => !(o.group_name === groupName && (o.team_id === teamId1 || o.team_id === teamId2))
    );
    
    // Add swapped positions
    newOverrides.push({
      id: '',
      user_id: profile?.id || '',
      group_name: groupName,
      team_id: teamId1,
      position: team2Standing.position,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    newOverrides.push({
      id: '',
      user_id: profile?.id || '',
      group_name: groupName,
      team_id: teamId2,
      position: team1Standing.position,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    
    setOverrides(newOverrides);
  };

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    setError("");

    try {
      // Convert predictions to array
      const predictionsArray = Array.from(predictions.values())
        .filter((p) => p.home_goals !== null || p.away_goals !== null)
        .map((p) => ({
          user_id: profile.id,
          match_id: p.match_id,
          home_goals: p.home_goals,
          away_goals: p.away_goals,
          winner_id: p.winner_id,
        }));

      // Upsert predictions
      const { error: predError } = await supabase
        .from("predictions")
        .upsert(predictionsArray, { onConflict: "user_id,match_id" });

      if (predError) throw predError;

      // Upsert overrides
      if (overrides.length > 0) {
        const { error: overrideError } = await supabase
          .from("group_standings_overrides")
          .upsert(
            overrides.map((o) => ({
              user_id: profile.id,
              group_name: o.group_name,
              team_id: o.team_id,
              position: o.position,
            })),
            { onConflict: "user_id,group_name,team_id" },
          );

        if (overrideError) throw overrideError;
      }

      alert("Predictions saved!");
    } catch (err) {
      setError("Failed to save predictions");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleRandomPredictions = () => {
    const newPredictions = new Map(predictions);
    
    matches.forEach((match) => {
      // Generate random scores (0-5 each)
      const homeGoals = Math.floor(Math.random() * 6);
      const awayGoals = Math.floor(Math.random() * 6);
      
      const existing = newPredictions.get(match.id);
      const updated: Prediction = {
        id: existing?.id || "",
        user_id: profile?.id || "",
        match_id: match.id,
        home_goals: homeGoals,
        away_goals: awayGoals,
        winner_id: existing?.winner_id ?? null,
        created_at: existing?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      newPredictions.set(match.id, updated);
    });
    
    setPredictions(newPredictions);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-white/60">Loading...</div>
      </div>
    );
  }

  const groupMatches = matches.filter((m) => m.stage === "GROUP_STAGE");
  const groups = new Map<string, Match[]>();
  groupMatches.forEach((m) => {
    if (!m.group) return;
    if (!groups.has(m.group)) groups.set(m.group, []);
    groups.get(m.group)!.push(m);
  });

  // Calculate standings for each group (for R32 preview)
  const groupStandings = new Map<string, CalculatedStanding[]>();
  groups.forEach((groupMatchList, groupName) => {
    groupStandings.set(groupName, calculateStandings(groupMatchList, groupName));
  });

  // Calculate which 3rd place teams qualify (best 8 of 12)
  const thirdPlaceQualifying = getQualifyingThirdPlaceTeams(groupStandings);

  const knockoutMatches = matches.filter((m) => m.stage !== "GROUP_STAGE");
  const knockoutStages = new Map<string, Match[]>();
  knockoutMatches.forEach((m) => {
    if (!knockoutStages.has(m.stage)) knockoutStages.set(m.stage, []);
    knockoutStages.get(m.stage)!.push(m);
  });

  const groupLocked = settings?.group_stage_locked || false;
  const knockoutOpen = settings?.knockout_stage_open || false;
  const knockoutLocked = settings?.knockout_stage_locked || false;

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={profile} />

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">My Predictions</h1>
            <p className="text-white/50 mt-1">Set your scores for each match</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleRandomPredictions}
              disabled={groupLocked && knockoutLocked}
              className="px-6 py-3 text-white font-semibold rounded-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              🎲 Random
            </button>
            <button
              onClick={handleSave}
              disabled={saving || (groupLocked && knockoutLocked)}
              className="px-6 py-3 text-white font-semibold rounded-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--qualifying-bg)' }}
            >
              {saving ? "Saving..." : "Save Predictions"}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl mb-6">
            {error}
          </div>
        )}

        {groupLocked && (
          <div className="bg-amber-500/20 border border-amber-500/30 text-amber-300 px-4 py-3 rounded-xl mb-6">
            Group stage predictions are locked
          </div>
        )}

        {/* Group Stage */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
              <span className="text-xl">🏆</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Group Stage</h2>
              <p className="text-white/50 text-sm">48 teams in 12 groups</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {Array.from(groups.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([groupName, groupMatchList]) => {
                const standings = calculateStandings(groupMatchList, groupName);
                return (
                  <div
                    key={groupName}
                    className="glass-card p-5"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <span className="px-4 py-2 bg-emerald-500/20 text-emerald-400 text-xl font-bold rounded-lg">
                        {groupName.replace('GROUP_', 'Group ')}
                      </span>
                    </div>

                    <div className="space-y-4">
                      {/* Matches */}
                      <div>
                        <h4 className="text-sm font-medium text-white/50 mb-3 uppercase tracking-wider">
                          Matches
                        </h4>
                        <div className="space-y-1">
                          {groupMatchList
                            .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime())
                            .map((match) => (
                            <PredictionInput
                              key={match.id}
                              match={match}
                              prediction={predictions.get(match.id)}
                              onChange={handlePredictionChange}
                              disabled={groupLocked}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Standings Table */}
                      <div>
                        <h4 className="text-sm font-medium text-white/50 mb-3 uppercase tracking-wider">
                          Standings
                          {!groupLocked && <span className="text-white/30 text-xs ml-2">(↕ swap tied teams)</span>}
                        </h4>
                        <StandingsTable
                          standings={standings}
                          disabled={groupLocked}
                          onSwapPositions={(team1, team2) => handleSwapPositions(groupName, team1, team2)}
                          thirdPlaceQualifies={thirdPlaceQualifying.get(groupName) || false}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>

        {/* Knockout Stage */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
              <span className="text-xl">⚔️</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Knockout Stage</h2>
              <p className="text-white/50 text-sm">Single elimination rounds</p>
            </div>
          </div>

          {!knockoutOpen ? (
            <div className="space-y-6">
              {/* R32 Preview - Shows teams based on group predictions */}
              <R32Preview 
                matches={knockoutStages.get("LAST_32") || []}
                groupStandings={groupStandings}
                thirdPlaceQualifying={thirdPlaceQualifying}
              />

              {/* Blurred rest of knockout */}
              <div className="relative">
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-10 rounded-xl flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-5xl mb-4">🔒</div>
                    <p className="text-white/60 text-lg">
                      Coming soon after group stage
                    </p>
                  </div>
                </div>
                <div className="space-y-6 opacity-50">
                  {["LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"].map((stage) => {
                    const stageName = stage.replace(/_/g, " ");
                    return (
                      <div key={stage} className="glass-card p-5">
                        <h3 className="font-bold text-lg mb-4 text-white">{stageName}</h3>
                        <div className="grid md:grid-cols-2 gap-4 h-20">
                          {/* Placeholder boxes */}
                          <div className="bg-white/5 rounded-lg h-12"></div>
                          <div className="bg-white/5 rounded-lg h-12"></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {knockoutLocked && (
                <div className="bg-amber-500/20 border border-amber-500/30 text-amber-300 px-4 py-3 rounded-xl">
                  Knockout stage predictions are locked
                </div>
              )}

              {[
                "LAST_32",
                "LAST_16",
                "QUARTER_FINALS",
                "SEMI_FINALS",
                "THIRD_PLACE",
                "FINAL",
              ].map((stage) => {
                const stageMatches = knockoutStages.get(stage) || [];
                if (stageMatches.length === 0) return null;

                const stageName = stage.replace(/_/g, " ");
                const needsWinner = ["THIRD_PLACE", "FINAL"].includes(stage);

                return (
                  <div
                    key={stage}
                    className="glass-card p-5"
                  >
                    <h3 className="font-bold text-lg mb-4 text-white">{stageName}</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      {stageMatches.map((match) => (
                        <PredictionInput
                          key={match.id}
                          match={match}
                          prediction={predictions.get(match.id)}
                          onChange={handlePredictionChange}
                          disabled={knockoutLocked}
                          showWinnerSelect={true}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-white/10 mt-auto">
        <div className="container mx-auto px-4 py-6 text-center">
          <p className="text-white/40 text-sm">WorldCupProde - FIFA World Cup 2026 Predictions</p>
        </div>
      </footer>
    </div>
  );
}

function createEmptyStanding(team: Team): CalculatedStanding {
  return {
    team,
    position: 0,
    points: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
  };
}
