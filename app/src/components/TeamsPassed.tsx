"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  getMatchDay,
  useMatches,
} from "@/contexts/MatchContext";
import { useDatabase } from "@/contexts/DatabaseContext";
import { useAllPredictions } from "@/contexts/PredictionsContext";
import { useAllProfiles, useUser } from "@/contexts/UserContext";
import { useTime } from "@/contexts/TimeContext";
import { useMatchDayNav } from "@/hooks/useMatchDayNav";
import { PredictionBracketResolver } from "@/lib/prediction-bracket-resolver";
import { CalculatedStanding, FifaMatchId, Team } from "@/types/football";
import { LocalPrediction } from "@/types/database";
import { ThirdPlaceTeam } from "@/lib/third-place-ranking";
import { formatGroupName } from "@/lib/format";
import UserName from "@/components/UserName";

interface UserBracket {
  userId: string;
  name: string;
  country: string | null;
  standings: Map<string, CalculatedStanding[]>;
  thirds: ThirdPlaceTeam[];
  /** Groups for which the user has predicted all matches (standings reliable) */
  completeGroups: Set<string>;
  /** True when the user predicted every group match (best-thirds reliable) */
  allGroupsComplete: boolean;
}

interface UserRef {
  userId: string;
  name: string;
  country: string | null;
}

function CountryBadge({ team }: { team: Team }) {
  return (
    <span className="flex items-center gap-1" title={team.name}>
      {team.crest ? (
        <img
          src={team.crest}
          alt={team.tla}
          className="w-4 h-4 object-contain"
        />
      ) : (
        <span className="w-4 h-4 inline-block" />
      )}
      <span className="text-xs font-semibold text-white/90">{team.tla}</span>
    </span>
  );
}

function UserList({
  users,
  currentUserId,
}: {
  users: UserRef[];
  currentUserId: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-y-1 min-w-0">
      {users.map((u, i) => (
        <span key={u.userId} className="flex items-center">
          {i > 0 && <span className="text-white/20 mx-1.5">·</span>}
          <Link
            href={`/user/${u.userId}`}
            className={`text-xs sm:text-sm hover:text-white transition-colors ${
              u.userId === currentUserId
                ? "text-cyan-300 font-medium"
                : "text-white/70"
            }`}
          >
            <UserName name={u.name} country={u.country} />
          </Link>
        </span>
      ))}
    </div>
  );
}

interface TeamRow {
  team: Team;
  users: UserRef[];
}

interface ComboRow {
  first: Team;
  second: Team;
  users: UserRef[];
}

/** A team flag with a small leading position number (used for 1st/2nd combos). */
function PositionBadge({ team, position }: { team: Team; position: number }) {
  return (
    <span className="flex items-center gap-1" title={team.name}>
      <span className="text-[9px] text-white/40 w-2 text-right">
        {position}
      </span>
      {team.crest ? (
        <img
          src={team.crest}
          alt={team.tla}
          className="w-4 h-4 object-contain"
        />
      ) : (
        <span className="w-4 h-4 inline-block" />
      )}
      <span className="text-xs font-semibold text-white/90">{team.tla}</span>
    </span>
  );
}

/** A labelled list of teams (each with the users who passed it), formatted
 *  identically across "1st place", "2nd place" and "Best 3rd place". */
function PassSection({
  label,
  rows,
  currentUserId,
  accent = "text-white/40",
}: {
  label: string;
  rows: TeamRow[];
  currentUserId: string | null;
  accent?: string;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-3 pt-3 border-t border-white/10 first:mt-0 first:pt-0 first:border-t-0">
      <div className={`text-[10px] uppercase tracking-wide mb-1.5 ${accent}`}>
        {label}
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.team.id}
            className="flex items-start gap-2 sm:gap-3"
          >
            <div className="shrink-0 px-2 py-1 bg-white/5 rounded">
              <CountryBadge team={row.team} />
            </div>
            <UserList users={row.users} currentUserId={currentUserId} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TeamsPassed() {
  const { matches, liveBracket } = useMatches();
  const { competitionLoading, currentCompetitionId } = useDatabase();
  const allPredictions = useAllPredictions();
  const profiles = useAllProfiles();
  const { user: profile } = useUser();
  const { stageLockStatus } = useTime();
  const { selectedDay } = useMatchDayNav();

  const currentUserId = profile?.id ?? null;
  const isAdmin = profile?.is_admin === true;
  const othersVisible = stageLockStatus.groupStageLocked;

  // Match ids and last scheduled day per group.
  const { groupLastDay, groupMatchIds, lastGroupDay } = useMemo(() => {
    const lastDay = new Map<string, string>();
    const matchIds = new Map<string, number[]>();
    for (const m of matches) {
      if (m.stage !== "GROUP_STAGE" || !m.group) continue;
      const day = getMatchDay(new Date(m.utcDate));
      const prev = lastDay.get(m.group);
      if (!prev || day > prev) lastDay.set(m.group, day);
      if (!matchIds.has(m.group)) matchIds.set(m.group, []);
      matchIds.get(m.group)!.push(m.id);
    }
    let max: string | null = null;
    for (const day of lastDay.values()) if (!max || day > max) max = day;
    return { groupLastDay: lastDay, groupMatchIds: matchIds, lastGroupDay: max };
  }, [matches]);

  // Groups whose final group match falls on the selected day.
  const closingGroups = useMemo(() => {
    if (!selectedDay) return [];
    return [...groupLastDay.entries()]
      .filter(([, day]) => day === selectedDay)
      .map(([g]) => g)
      .sort();
  }, [groupLastDay, selectedDay]);

  const showBestThirds =
    !!selectedDay && selectedDay === lastGroupDay && closingGroups.length > 0;

  // Predicted standings + best-thirds per user.
  const userBrackets = useMemo<UserBracket[]>(() => {
    if (!allPredictions.content || !profiles.content || !liveBracket) return [];

    const result: UserBracket[] = [];
    for (const p of profiles.content) {
      // Visibility: before the group stage locks, only the current user (and
      // admins) can see others' predicted qualifiers.
      if (!othersVisible && !isAdmin && p.id !== currentUserId) continue;

      const data = allPredictions.content.get(p.id);
      const predictionMap = new Map<FifaMatchId, LocalPrediction>();
      const predictedIds = new Set<number>();
      (data?.predictions || []).forEach((pr) => {
        predictionMap.set(pr.match_id as FifaMatchId, pr);
        if (pr.home_goals !== null && pr.away_goals !== null) {
          predictedIds.add(pr.match_id);
        }
      });
      if (predictedIds.size === 0) continue;

      const bracket = new PredictionBracketResolver({
        liveBracket,
        matches,
        predictions: predictionMap,
        groupOverrides: data?.overrides || [],
        thirdPlaceOverrides: data?.thirdPlaceOverrides || [],
      }).resolve();

      const completeGroups = new Set<string>();
      groupMatchIds.forEach((ids, group) => {
        if (ids.every((id) => predictedIds.has(id))) completeGroups.add(group);
      });

      result.push({
        userId: p.id,
        name: p.display_name,
        country: p.country,
        standings: bracket.groupStandings,
        thirds: bracket.rankedThirdPlaceTeams,
        completeGroups,
        allGroupsComplete: completeGroups.size === groupMatchIds.size,
      });
    }

    return result;
  }, [
    allPredictions.content,
    profiles.content,
    liveBracket,
    matches,
    groupMatchIds,
    othersVisible,
    isAdmin,
    currentUserId,
  ]);

  // For each closing group: combos grouping users by their predicted top-two
  // (1st + 2nd) pair, plus the qualifying best thirds.
  const sections = useMemo(() => {
    const sortRows = (m: Map<number, TeamRow>): TeamRow[] =>
      [...m.values()]
        .map((r) => ({
          ...r,
          users: r.users.sort((a, b) => a.name.localeCompare(b.name)),
        }))
        .sort(
          (a, b) =>
            b.users.length - a.users.length ||
            a.team.tla.localeCompare(b.team.tla),
        );

    // Group users by their predicted (1st, 2nd) team pair within a group.
    const buildCombos = (group: string): ComboRow[] => {
      const m = new Map<string, ComboRow>();
      for (const u of userBrackets) {
        if (!u.completeGroups.has(group)) continue;
        const s = u.standings.get(group) || [];
        const first = s[0]?.team;
        const second = s[1]?.team;
        if (!first || !second) continue;
        const key = `${first.id}-${second.id}`;
        if (!m.has(key)) m.set(key, { first, second, users: [] });
        m.get(key)!.users.push({
          userId: u.userId,
          name: u.name,
          country: u.country,
        });
      }
      return [...m.values()]
        .map((r) => ({
          ...r,
          users: r.users.sort((a, b) => a.name.localeCompare(b.name)),
        }))
        .sort(
          (a, b) =>
            b.users.length - a.users.length ||
            a.first.tla.localeCompare(b.first.tla),
        );
    };

    // Best-third candidates per closing group.
    const closingSet = new Set(closingGroups);
    const thirdAcc = new Map<string, Map<number, TeamRow>>();
    for (const u of userBrackets) {
      if (!u.allGroupsComplete) continue;
      for (const t of u.thirds) {
        if (!t.qualifies || !closingSet.has(t.group)) continue;
        if (!thirdAcc.has(t.group)) thirdAcc.set(t.group, new Map());
        const m = thirdAcc.get(t.group)!;
        if (!m.has(t.team.id)) m.set(t.team.id, { team: t.team, users: [] });
        m.get(t.team.id)!.users.push({
          userId: u.userId,
          name: u.name,
          country: u.country,
        });
      }
    }

    const byGroup = new Map<
      string,
      { combos: ComboRow[]; third: TeamRow[] }
    >();
    for (const group of closingGroups) {
      byGroup.set(group, {
        combos: buildCombos(group),
        third: thirdAcc.has(group) ? sortRows(thirdAcc.get(group)!) : [],
      });
    }
    return byGroup;
  }, [closingGroups, userBrackets]);

  // Best thirds grouped by source group, then by individual country: for each
  // team that a user passed as a best third, list everyone who had it. Groups
  // are separated visually (last day only).
  const thirdByGroup = useMemo(() => {
    if (!showBestThirds) return [];
    const byTeam = new Map<
      number,
      { team: ThirdPlaceTeam; users: UserRef[] }
    >();
    for (const u of userBrackets) {
      if (!u.allGroupsComplete) continue;
      for (const t of u.thirds) {
        if (!t.qualifies) continue;
        if (!byTeam.has(t.team.id)) byTeam.set(t.team.id, { team: t, users: [] });
        byTeam.get(t.team.id)!.users.push({
          userId: u.userId,
          name: u.name,
          country: u.country,
        });
      }
    }

    const byGroup = new Map<
      string,
      { team: ThirdPlaceTeam; users: UserRef[] }[]
    >();
    for (const entry of byTeam.values()) {
      entry.users.sort((a, b) => a.name.localeCompare(b.name));
      const g = entry.team.group;
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g)!.push(entry);
    }

    return [...byGroup.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([group, rows]) => ({
        group,
        rows: rows.sort(
          (a, b) =>
            b.users.length - a.users.length ||
            a.team.team.tla.localeCompare(b.team.team.tla),
        ),
      }));
  }, [showBestThirds, userBrackets]);

  // Only block on the very first load when there is no data at all.
  if ((competitionLoading || !currentCompetitionId) && !allPredictions.content)
    return null;
  if (!allPredictions.content || !profiles.content) return null;

  // Render nothing on days that don't close a group.
  if (closingGroups.length === 0) return null;

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-600 to-teal-600 px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-2 sm:gap-3">
        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-xl flex items-center justify-center">
          <span className="text-xl sm:text-2xl">🎫</span>
        </div>
        <div className="flex-1">
          <h2 className="text-lg sm:text-xl font-bold text-white">
            Teams Passed
          </h2>
          <p className="text-cyan-100 text-xs sm:text-sm">
            {closingGroups.length} group
            {closingGroups.length !== 1 ? "s" : ""} closing
          </p>
        </div>
      </div>

      {/* Group cards (one row per group) */}
      <div className="divide-y-2 divide-white/15">
        {closingGroups.map((group) => {
          const sec = sections.get(group);
          const hasAny =
            !!sec && (sec.combos.length > 0 || sec.third.length > 0);
          return (
            <div key={group} className="px-4 sm:px-6 pb-3 sm:pb-4">
              {/* Group header */}
              <div className="flex items-center justify-center mb-3 bg-gradient-to-r from-cyan-500/20 to-teal-500/20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2">
                <span className="text-xs sm:text-sm font-semibold text-white">
                  {formatGroupName(group)}
                </span>
              </div>

              {!hasAny || !sec ? (
                <p className="text-white/30 text-xs text-center">
                  No predictions
                </p>
              ) : (
                <>
                  {/* 1st + 2nd flag combinations */}
                  {sec.combos.length > 0 && (
                    <div className="space-y-2">
                      {sec.combos.map((row, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2 sm:gap-3"
                        >
                          <div className="shrink-0 flex flex-col gap-0.5 px-2 py-1 bg-white/5 rounded">
                            <PositionBadge team={row.first} position={1} />
                            <PositionBadge team={row.second} position={2} />
                          </div>
                          <UserList
                            users={row.users}
                            currentUserId={currentUserId}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <PassSection
                    label="⭐ Best 3rd place"
                    rows={sec.third}
                    currentUserId={currentUserId}
                    accent="text-amber-300/70"
                  />
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Best thirds (only once all groups have closed) */}
      {showBestThirds && (
        <div className="border-t-4 border-white/20">
          <div className="px-4 sm:px-6 py-2 bg-gradient-to-r from-amber-500/20 to-yellow-500/20">
            <span className="text-xs sm:text-sm font-semibold text-white">
              ⭐ Best 3rd-place qualifiers
            </span>
          </div>
          <div className="px-4 sm:px-6 py-3">
            {thirdByGroup.length === 0 ? (
              <p className="text-white/30 text-xs text-center">
                No predictions
              </p>
            ) : (
              <div className="divide-y divide-white/10">
                {thirdByGroup.map(({ group, rows }) => (
                  <div key={group} className="py-2 first:pt-0 last:pb-0">
                    <div className="text-[10px] uppercase tracking-wide text-white/40 mb-1.5">
                      {formatGroupName(group)}
                    </div>
                    <div className="space-y-2">
                      {rows.map((row) => (
                        <div
                          key={row.team.team.id}
                          className="flex items-start gap-2 sm:gap-3"
                        >
                          <div className="shrink-0 px-2 py-1 bg-white/5 rounded">
                            <CountryBadge team={row.team.team} />
                          </div>
                          <UserList
                            users={row.users}
                            currentUserId={currentUserId}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
