"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { GlobalLiveIndicator } from "@/components/MatchStatus";
import {
  KnockoutStageSection,
  GroupStageSection,
  KnockoutPreviewSection,
} from "@/components/predictions";
import { useMatches } from "@/contexts/MatchContext";
import { useSimulation } from "@/contexts/SimulationContext";
import { useUser } from "@/contexts/UserContext";
import { createClient } from "@/lib/supabase/client";
import { CalculatedStanding, Team, Match } from "@/types/football";
import { getQualifyingThirdPlaceTeams } from "@/lib/third-place-ranking";
import { BracketResolver } from "@/lib/bracket-resolver";
import { buildApiToFifaMapping } from "@/lib/api-client";
import { Prediction, GroupStandingsOverride } from "@/types/database";

export default function PredictionsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { user: profile, loading: userLoading } = useUser();

  const [predictions, setPredictions] = useState<Map<number, Prediction>>(
    new Map(),
  );
  const [overrides, setOverrides] = useState<GroupStandingsOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Use centralized match context for automatic polling
  const {
    matches,
    loading: matchesLoading,
    hasLiveMatches,
    liveMatches,
    refresh: refreshMatches,
  } = useMatches();

  // Get stage lock status from simulation context (time-based)
  const { stageLockStatus } = useSimulation();
  const {
    groupStageLocked: groupLocked,
    knockoutStageOpen: knockoutOpen,
    knockoutStageLocked: knockoutLocked,
  } = stageLockStatus;

  useEffect(() => {
    // Redirect if not logged in (after user loading completes)
    if (!userLoading && !profile) {
      router.push("/login?redirect=/predictions");
      return;
    }

    if (!profile) return;

    const loadData = async () => {
      // Load user predictions
      const { data: predictionsData } = await supabase
        .from("predictions")
        .select("*")
        .eq("user_id", profile.id);

      const predMap = new Map();
      (predictionsData as unknown as Prediction[] | null)?.forEach(
        (p: Prediction) => predMap.set(p.match_id, p),
      );
      setPredictions(predMap);

      // Load standing overrides
      const { data: overridesData } = await supabase
        .from("group_standings_overrides")
        .select("*")
        .eq("user_id", profile.id);
      setOverrides(overridesData || []);

      setLoading(false);
    };

    loadData();
  }, [supabase, router, profile, userLoading]);

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
        const groupOverrides = overrides.filter(
          (o) => o.group_name === groupName,
        );
        if (groupOverrides.length > 0) {
          // Sort by override positions
          standings = standings
            .map((s) => {
              const override = groupOverrides.find(
                (o) => o.team_id === s.team.id,
              );
              return { ...s, position: override?.position || s.position };
            })
            .sort((a, b) => a.position - b.position)
            .map((s, i) => ({ ...s, position: i + 1 }));
        }
      }

      return standings;
    },
    [predictions, overrides],
  );

  const handleSwapPositions = (
    groupName: string,
    teamId1: number,
    teamId2: number,
  ) => {
    // Find current positions
    const groupMatches = matches.filter((m) => m.group === groupName);
    const standings = calculateStandings(groupMatches, groupName);

    const team1Standing = standings.find((s) => s.team.id === teamId1);
    const team2Standing = standings.find((s) => s.team.id === teamId2);

    if (!team1Standing || !team2Standing) return;

    // Create new overrides swapping positions
    const newOverrides = overrides.filter(
      (o) =>
        !(
          o.group_name === groupName &&
          (o.team_id === teamId1 || o.team_id === teamId2)
        ),
    );

    // Add swapped positions
    newOverrides.push({
      id: "",
      user_id: profile?.id || "",
      group_name: groupName,
      team_id: teamId1,
      position: team2Standing.position,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    newOverrides.push({
      id: "",
      user_id: profile?.id || "",
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

  const handleResetPredictions = () => {
    if (
      !confirm(
        "Are you sure you want to reset predictions? This will clear scores for unlocked sections.",
      )
    ) {
      return;
    }

    // Filter out predictions for unlocked sections only
    const newPredictions = new Map(predictions);
    matches.forEach((match) => {
      const isGroupStage = match.stage === "GROUP_STAGE";
      if (isGroupStage && !groupLocked) {
        newPredictions.delete(match.id);
      }
      if (!isGroupStage && knockoutOpen && !knockoutLocked) {
        newPredictions.delete(match.id);
      }
    });
    setPredictions(newPredictions);

    // Clear overrides only if group stage isn't locked
    if (!groupLocked) {
      setOverrides([]);
    }
  };

  // Build API match ID to FIFA match number mapping for knockout matches
  const apiToFifaMap = useMemo(() => buildApiToFifaMapping(matches), [matches]);

  if (loading || matchesLoading) {
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
    groupStandings.set(
      groupName,
      calculateStandings(groupMatchList, groupName),
    );
  });

  // Calculate which 3rd place teams qualify (best 8 of 12)
  const thirdPlaceQualifying = getQualifyingThirdPlaceTeams(groupStandings);

  const knockoutMatches = matches.filter((m) => m.stage !== "GROUP_STAGE");
  const knockoutStages = new Map<string, Match[]>();
  knockoutMatches.forEach((m) => {
    if (!knockoutStages.has(m.stage)) knockoutStages.set(m.stage, []);
    knockoutStages.get(m.stage)!.push(m);
  });

  // Use BracketResolver to resolve knockout teams based on predictions
  const resolver = new BracketResolver({
    matches,
    predictions,
    groupStandings,
    thirdPlaceQualifying,
  });
  const resolvedKnockoutTeams = resolver.resolve();

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">My Predictions</h1>
            <p className="text-white/50 mt-1">Set your scores for each match</p>
            <div className="mt-2">
              <GlobalLiveIndicator
                hasLiveMatches={hasLiveMatches}
                liveCount={liveMatches.length}
                onClick={refreshMatches}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleResetPredictions}
              disabled={groupLocked && knockoutLocked}
              className="px-6 py-3 text-white font-semibold rounded-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed bg-red-600 hover:bg-red-700"
            >
              🗑️ Reset
            </button>
            <button
              onClick={handleSave}
              disabled={saving || (groupLocked && knockoutLocked)}
              className="px-6 py-3 text-white font-semibold rounded-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "var(--qualifying-bg)" }}
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

        {/* Knockout Stage Section - when knockout is open */}
        {knockoutOpen && (
          <KnockoutStageSection
            knockoutStages={knockoutStages}
            predictions={predictions}
            resolvedKnockoutTeams={resolvedKnockoutTeams}
            apiToFifaMap={apiToFifaMap}
            knockoutLocked={knockoutLocked}
            onPredictionChange={handlePredictionChange}
          />
        )}

        {/* Group Stage */}
        <div className={knockoutOpen ? "" : "mb-10"}>
          <GroupStageSection
            groups={groups}
            predictions={predictions}
            apiToFifaMap={apiToFifaMap}
            groupLocked={groupLocked}
            thirdPlaceQualifying={thirdPlaceQualifying}
            calculateStandings={calculateStandings}
            onPredictionChange={handlePredictionChange}
            onSwapPositions={handleSwapPositions}
          />
        </div>

        {/* Knockout Stage - when not yet open */}
        {!knockoutOpen && (
          <KnockoutPreviewSection
            knockoutStages={knockoutStages}
            groupStandings={groupStandings}
            thirdPlaceQualifying={thirdPlaceQualifying}
          />
        )}
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
