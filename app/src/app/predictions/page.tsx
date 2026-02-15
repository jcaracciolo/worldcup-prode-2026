"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GlobalLiveIndicator } from "@/components/MatchStatus";
import LockedCard from "@/components/LockedCard";
import {
  KnockoutStageSection,
  GroupStageSection,
} from "@/components/predictions";
import { useMatches } from "@/contexts/MatchContext";
import { useTime } from "@/contexts/TimeContext";
import { useUser } from "@/contexts/UserContext";
import { useUserPredictions } from "@/contexts/PredictionsContext";
import { CalculatedStanding, Team, Match, FifaMatchId, asFifaMatchId } from "@/types/football";
import { getQualifyingThirdPlaceTeams } from "@/lib/third-place-ranking";

import { LocalPrediction, LocalGroupStandingsOverride } from "@/types/database";

export default function PredictionsPage() {
  const router = useRouter();
  const { user: profile, loading: userLoading } = useUser();

  // Use cached predictions from context (initializes from cache synchronously)
  const {
    predictions: cachedPredictions,
    overrides: cachedOverrides,
    loading: predictionsLoading,
    savePredictions: contextSavePredictions,
  } = useUserPredictions(profile?.id || null);

  // Local state for editing - initialize directly from cache
  const [predictions, setPredictions] = useState<
    Map<FifaMatchId, LocalPrediction>
  >(
    () =>
      new Map(
        Array.from(cachedPredictions.entries()).map(([k, v]) => [
          k,
          {
            match_id: v.match_id,
            home_goals: v.home_goals,
            away_goals: v.away_goals,
            winner_id: v.winner_id,
          },
        ]),
      ),
  );
  const [overrides, setOverrides] = useState<LocalGroupStandingsOverride[]>(
    () =>
      cachedOverrides.map((o) => ({
        group_name: o.group_name,
        team_id: o.team_id,
        position: o.position,
      })),
  );
  const [hasLocalEdits, setHasLocalEdits] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Sync from cache when it changes (but not if user has local edits)
  useEffect(() => {
    if (!hasLocalEdits && !predictionsLoading && cachedPredictions.size > 0) {
      // Use queueMicrotask to avoid sync setState warning
      queueMicrotask(() => {
        setPredictions(
          new Map(
            Array.from(cachedPredictions.entries()).map(([k, v]) => [
              k,
              {
                match_id: v.match_id,
                home_goals: v.home_goals,
                away_goals: v.away_goals,
                winner_id: v.winner_id,
              },
            ]),
          ),
        );
        setOverrides(
          cachedOverrides.map((o) => ({
            group_name: o.group_name,
            team_id: o.team_id,
            position: o.position,
          })),
        );
      });
    }
  }, [hasLocalEdits, predictionsLoading, cachedPredictions, cachedOverrides]);

  // Use centralized match context for automatic polling
  const {
    matches,
    loading: matchesLoading,
    hasLiveMatches,
    liveMatches,
    refresh: refreshMatches,
  } = useMatches();

  // Scroll to first live match
  const scrollToFirstLiveMatch = useCallback(() => {
    const firstLiveMatch = document.querySelector(".live-match");
    if (firstLiveMatch) {
      firstLiveMatch.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  // Get stage lock status from time context (simulation-transparent)
  const { stageLockStatus } = useTime();
  const {
    groupStageLocked: groupLocked,
    knockoutStageOpen: knockoutOpen,
    knockoutStageLocked: knockoutLocked,
    daysUntilKnockoutLocks,
  } = stageLockStatus;

  // Tab state - default to knockout if it's open
  const [activeTab, setActiveTab] = useState<"group" | "knockout">(() =>
    knockoutOpen ? "knockout" : "group",
  );

  // Redirect if not logged in
  useEffect(() => {
    if (!userLoading && !profile) {
      router.push("/login?redirect=/predictions");
    }
  }, [userLoading, profile, router]);

  // Derived loading state - only show loading on initial load when we have no data
  const loading = userLoading || (predictionsLoading && predictions.size === 0);
  const showMatchesLoading = matchesLoading && matches.length === 0;

  const handlePredictionChange = (
    fifaMatchId: FifaMatchId,
    homeGoals: number | null,
    awayGoals: number | null,
    winnerId?: number | null,
  ) => {
    setHasLocalEdits(true);
    const existing = predictions.get(fifaMatchId);
    const updated: LocalPrediction = {
      match_id: fifaMatchId,
      home_goals: homeGoals,
      away_goals: awayGoals,
      winner_id: winnerId ?? existing?.winner_id ?? null,
    };
    setPredictions(new Map(predictions.set(fifaMatchId, updated)));
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

      // Calculate from predictions (match.id is the FIFA number)
      groupMatches.forEach((match) => {
        const fifaNumber = asFifaMatchId(match.id);

        const prediction = predictions.get(fifaNumber);
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
      group_name: groupName,
      team_id: teamId1,
      position: team2Standing.position,
    });
    newOverrides.push({
      group_name: groupName,
      team_id: teamId2,
      position: team1Standing.position,
    });

    setHasLocalEdits(true);
    setOverrides(newOverrides);
  };

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    setError("");

    const result = await contextSavePredictions(predictions, overrides);

    if (result.success) {
      setHasLocalEdits(false);
      alert("Predictions saved!");
    } else {
      setError(result.error || "Failed to save predictions");
    }

    setSaving(false);
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
      const fifaNumber = asFifaMatchId(match.id);

      const isGroupStage = match.stage === "GROUP_STAGE";
      if (isGroupStage && !groupLocked) {
        newPredictions.delete(fifaNumber);
      }
      if (!isGroupStage && knockoutOpen && !knockoutLocked) {
        newPredictions.delete(fifaNumber);
      }
    });
    setPredictions(newPredictions);

    // Clear overrides only if group stage isn't locked
    if (!groupLocked) {
      setOverrides([]);
    }
  };

  const handleRandomFill = () => {
    if (
      !confirm(
        "This will fill all empty prediction slots with random scores. Continue?",
      )
    ) {
      return;
    }

    setHasLocalEdits(true);
    const newPredictions = new Map(predictions);

    matches.forEach((match) => {
      const fifaNumber = asFifaMatchId(match.id);

      // Check if already has a prediction
      const existing = newPredictions.get(fifaNumber);
      if (
        existing &&
        existing.home_goals !== null &&
        existing.away_goals !== null
      ) {
        return; // Skip if already predicted
      }

      const isGroupStage = match.stage === "GROUP_STAGE";

      // Only fill if section is unlocked
      if (isGroupStage && groupLocked) return;
      if (!isGroupStage && (!knockoutOpen || knockoutLocked)) return;

      // Generate random scores (0-4 range, weighted toward lower scores)
      const randomScore = () => {
        const r = Math.random();
        if (r < 0.4) return 0;
        if (r < 0.7) return 1;
        if (r < 0.85) return 2;
        if (r < 0.95) return 3;
        return 4;
      };

      const homeGoals = randomScore();
      const awayGoals = randomScore();

      // For knockout ties, randomly pick a winner
      let winnerId: number | null = null;
      if (!isGroupStage && homeGoals === awayGoals) {
        winnerId = Math.random() < 0.5 ? match.homeTeam.id : match.awayTeam.id;
      }

      const updated: LocalPrediction = {
        match_id: fifaNumber,
        home_goals: homeGoals,
        away_goals: awayGoals,
        winner_id: winnerId,
      };
      newPredictions.set(fifaNumber, updated);
    });

    setPredictions(newPredictions);
  };

  if (loading || showMatchesLoading) {
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

  return (
    <div className="flex-1 flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-4 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              My Predictions
            </h1>
            <p className="text-white/50 mt-1 text-sm sm:text-base">
              Set your scores for each match
            </p>
            <div className="mt-2">
              <GlobalLiveIndicator
                hasLiveMatches={hasLiveMatches}
                liveCount={liveMatches.length}
                onClick={scrollToFirstLiveMatch}
              />
            </div>
          </div>
          {/* Show buttons only when there's something to edit */}
          {(!groupLocked || (knockoutOpen && !knockoutLocked)) && (
            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={handleRandomFill}
                className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base text-white font-semibold rounded-xl transition-all shadow-lg bg-purple-600 hover:bg-purple-700"
              >
                🎲 Random
              </button>
              <button
                onClick={handleResetPredictions}
                className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base text-white font-semibold rounded-xl transition-all shadow-lg bg-red-600 hover:bg-red-700"
              >
                🗑️ Reset
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base text-white font-semibold rounded-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: "var(--qualifying-bg)" }}
              >
                {saving ? "Saving..." : "Save Predictions"}
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl mb-6">
            {error}
          </div>
        )}

        {/* Warning banner for knockout predictions deadline */}
        {daysUntilKnockoutLocks !== null && !knockoutLocked && (
          <div className="bg-red-600/90 border border-red-500 text-white px-4 py-3 rounded-xl mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <div className="font-bold">Knockout predictions lock soon!</div>
                <div className="text-red-100 text-sm">
                  {daysUntilKnockoutLocks === 0
                    ? "Locking today!"
                    : daysUntilKnockoutLocks === 1
                      ? "Only 1 day left to finish your knockout predictions"
                      : `Only ${daysUntilKnockoutLocks} days left to finish your knockout predictions`}
                </div>
              </div>
            </div>
            <button
              onClick={() => setActiveTab("knockout")}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-semibold transition-colors"
            >
              Go to Knockout →
            </button>
          </div>
        )}

        {/* Link to see score on profile - shown when buttons are hidden (all editable sections locked) */}
        {groupLocked && (!knockoutOpen || knockoutLocked) && profile && (
          <Link
            href={`/user/${profile.id}`}
            className="block w-full mb-6 px-6 py-4 bg-gradient-to-r from-emerald-600/80 to-green-600/80 hover:from-emerald-500 hover:to-green-500 text-white font-semibold rounded-xl transition-all shadow-lg text-center border border-emerald-400/30"
          >
            <span className="text-lg">📊 See your score on your profile →</span>
          </Link>
        )}

        {groupLocked && (
          <div className="bg-amber-500/20 border border-amber-500/30 text-amber-300 px-4 py-3 rounded-xl mb-6">
            Group stage predictions are locked
          </div>
        )}

        {/* Stage Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("group")}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all ${
              activeTab === "group"
                ? "bg-emerald-600 text-white"
                : "bg-white/10 text-white/60 hover:bg-white/20"
            }`}
          >
            Group Stage
          </button>
          <button
            onClick={() => setActiveTab("knockout")}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all ${
              activeTab === "knockout"
                ? "bg-amber-600 text-white"
                : "bg-white/10 text-white/60 hover:bg-white/20"
            }`}
          >
            Knockout Stage
          </button>
        </div>

        {/* Group Stage */}
        {activeTab === "group" && (
          <GroupStageSection
            groups={groups}
            predictions={predictions}
            groupLocked={groupLocked}
            thirdPlaceQualifying={thirdPlaceQualifying}
            calculateStandings={calculateStandings}
            onPredictionChange={handlePredictionChange}
            onSwapPositions={handleSwapPositions}
          />
        )}

        {/* Knockout Stage */}
        {activeTab === "knockout" &&
          (knockoutOpen ? (
            <KnockoutStageSection
              knockoutStages={knockoutStages}
              predictions={predictions}
              knockoutLocked={knockoutLocked}
              onPredictionChange={handlePredictionChange}
            />
          ) : (
            <LockedCard message="Knockout predictions will be available after group stage locks" />
          ))}
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
