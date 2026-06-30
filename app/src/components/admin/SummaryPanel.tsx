"use client";

import { useState, useMemo, useCallback } from "react";
import { useMatches, getMatchDay } from "@/contexts/MatchContext";
import { useAllPredictions } from "@/contexts/PredictionsContext";
import { useAllProfiles } from "@/contexts/UserContext";
import { useLeaderboard } from "@/contexts/LeaderboardContext";
import { useTime } from "@/contexts/TimeContext";
import { FifaMatchId, Match } from "@/types/football";
import { calculateTotalPoints } from "@/lib/scoring";
import { LiveBracketResolver } from "@/lib/live-bracket-resolver";

/**
 * Convert ISO 3166-1 alpha-2 country code to flag emoji.
 * e.g. "ar" → "🇦🇷", "mx" → "🇲🇽"
 */
function countryToFlagEmoji(country: string | null | undefined): string {
  if (!country || country.length !== 2) return "";
  const codePoints = [...country.toUpperCase()].map(
    (c) => 0x1f1e6 + c.charCodeAt(0) - 65,
  );
  return String.fromCodePoint(...codePoints);
}

/** Format a user's name with flag emoji prefix */
function nameWithFlag(name: string, country: string | null | undefined): string {
  const flag = countryToFlagEmoji(country);
  return flag ? `${flag} ${name}` : name;
}

export default function SummaryPanel() {
  const { todaysMatches, matches } = useMatches();
  const allPredictions = useAllPredictions();
  const profiles = useAllProfiles();
  const { scores } = useLeaderboard();
  const { getCurrentTime } = useTime();

  const [copiedPredictions, setCopiedPredictions] = useState(false);
  const [copiedPoints, setCopiedPoints] = useState(false);

  const todayStr = getMatchDay(getCurrentTime());

  const profileMap = useMemo(() => {
    const map = new Map<string, { name: string; country: string | null }>();
    (profiles.content || []).forEach((p) =>
      map.set(p.id, { name: p.display_name, country: p.country }),
    );
    return map;
  }, [profiles.content]);

  // Build predictions text: group identical predictions together per match
  const buildPredictionsText = useCallback(() => {
    const predictionsMap = allPredictions.content;
    if (!predictionsMap || todaysMatches.length === 0) return "";

    const lines: string[] = [];
    lines.push(`⚽ Predicciones — ${todayStr}`);
    lines.push("");

    for (const match of todaysMatches) {
      const homeTla = match.homeTeam?.tla || "???";
      const awayTla = match.awayTeam?.tla || "???";
      const time = new Date(match.utcDate).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      lines.push(`🏟️ #${match.id} ${homeTla} vs ${awayTla} (${time})`);

      // Collect all predictions for this match, grouped by score
      const grouped = new Map<string, { name: string; country: string | null }[]>();

      predictionsMap.forEach((userData, userId) => {
        const profile = profileMap.get(userId);
        if (!profile) return; // skip users not in this competition

        const pred = userData.predictions.find(
          (p) => p.match_id === (match.id as FifaMatchId),
        );
        if (!pred || pred.home_goals === null || pred.away_goals === null)
          return;

        const key = `${pred.home_goals}-${pred.away_goals}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push({ name: profile.name, country: profile.country });
      });

      // Group by outcome: home wins, ties, away wins
      const homeWins = [...grouped.entries()].filter(([s]) => {
        const [h, a] = s.split("-").map(Number);
        return h > a;
      });
      const ties = [...grouped.entries()].filter(([s]) => {
        const [h, a] = s.split("-").map(Number);
        return h === a;
      });
      const awayWins = [...grouped.entries()].filter(([s]) => {
        const [h, a] = s.split("-").map(Number);
        return h < a;
      });

      // Within each group, sort by winner goals desc, then loser goals desc
      const byGoals = (a: [string, { name: string; country: string | null }[]], b: [string, { name: string; country: string | null }[]]) => {
        const [ah, aa] = a[0].split("-").map(Number);
        const [bh, ba] = b[0].split("-").map(Number);
        const aWinner = Math.max(ah, aa), aLoser = Math.min(ah, aa);
        const bWinner = Math.max(bh, ba), bLoser = Math.min(bh, ba);
        if (bWinner !== aWinner) return bWinner - aWinner;
        return bLoser - aLoser;
      };
      const sorted = [
        ...homeWins.sort(byGoals),
        ...ties.sort(byGoals),
        ...awayWins.sort(byGoals),
      ];

      if (sorted.length === 0) {
        lines.push("  Sin predicciones");
      } else {
        for (const [score, users] of sorted) {
          lines.push(`  ${score}`);
          for (const u of users.sort((a, b) => a.name.localeCompare(b.name))) {
            lines.push(`    • ${nameWithFlag(u.name, u.country)}`);
          }
        }
      }
      lines.push("");
    }

    return lines.join("\n");
  }, [allPredictions.content, todaysMatches, profileMap, todayStr]);

  // Build points text: standings + today's match/bonus split + position changes.
  //
  // "Today" = the delta vs the state before today's matches. We recompute each
  // user's score with today's scorable matches reverted to not-started, then:
  //   matchPoints today = (match total now)  - (match total before)
  //   bonus  today = (group bonus now) - (group bonus before)
  // The position arrows are computed from the before-today totals, so they
  // correctly account for bonus awarded today (e.g. when a group completes).
  const buildPointsText = useCallback(() => {
    const predictionsMap = allPredictions.content;
    if (!predictionsMap || matches.length === 0 || scores.length === 0) {
      return "";
    }

    // Only finished/live matches scheduled for today are "scored today"
    const scorableToday = todaysMatches.filter(
      (m) =>
        m.status === "FINISHED" ||
        m.status === "IN_PLAY" ||
        m.status === "PAUSED",
    );
    const todayIds = new Set(scorableToday.map((m) => m.id));

    // Build the "before today" match set by reverting today's scorable matches
    // to a not-started state, then recompute the bracket from it.
    const matchesBefore: (Match & { fifaNumber?: FifaMatchId | null })[] =
      matches.map((m) => {
        const base = { ...m, fifaNumber: m.fifaNumber as FifaMatchId | null };
        if (!todayIds.has(m.id)) return base;
        return {
          ...base,
          status: "TIMED" as Match["status"],
          score: {
            ...m.score,
            winner: null,
            fullTime: { home: null, away: null },
            halfTime: { home: null, away: null },
          },
        };
      });

    // Per-user "before today" totals. Skip the recompute entirely when nothing
    // is scored today (deltas are all zero, before == now).
    const beforeByUser = new Map<string, { total: number; bonus: number }>();
    if (scorableToday.length > 0) {
      const liveBracketBefore = new LiveBracketResolver(matchesBefore).resolve();
      scores.forEach((s) => {
        const userData = predictionsMap.get(s.userId);
        const { totalPoints, breakdown } = calculateTotalPoints(
          matchesBefore,
          userData?.predictions || [],
          userData?.overrides || [],
          liveBracketBefore,
          userData?.thirdPlaceOverrides || [],
        );
        let bonus = 0;
        for (const item of breakdown) {
          if (item.type === "group_advance" || item.type === "group_position") {
            bonus += item.points;
          }
        }
        beforeByUser.set(s.userId, { total: totalPoints, bonus });
      });
    }

    // Build per-user entries with today's match/bonus split.
    const entries = scores.map((s) => {
      const currentBonus = s.groupBonusPoints;
      const before = beforeByUser.get(s.userId) ?? {
        total: s.totalPoints,
        bonus: currentBonus,
      };
      const todayBonus = currentBonus - before.bonus;
      const todayMatch =
        s.totalPoints - currentBonus - (before.total - before.bonus);
      return {
        userId: s.userId,
        name: s.displayName,
        country: s.country,
        position: s.position,
        totalPoints: s.totalPoints,
        todayMatch,
        todayBonus,
        beforeTotal: before.total,
      };
    });

    // Compute yesterday's positions by sorting on the before-today total.
    const yesterdayOrder = [...entries].sort(
      (a, b) => b.beforeTotal - a.beforeTotal || a.name.localeCompare(b.name),
    );
    const yesterdayPositions = new Map<string, number>();
    let pos = 1;
    for (let i = 0; i < yesterdayOrder.length; i++) {
      if (i > 0 && yesterdayOrder[i].beforeTotal < yesterdayOrder[i - 1].beforeTotal) {
        pos = i + 1;
      }
      yesterdayPositions.set(yesterdayOrder[i].userId, pos);
    }

    const lines: string[] = [];
    lines.push(`📊 Tabla de posiciones — ${todayStr}`);

    // List which matches are included (if any)
    if (scorableToday.length > 0) {
      const matchLabels = scorableToday.map((m) => {
        const home = m.homeTeam?.tla || "???";
        const away = m.awayTeam?.tla || "???";
        const homeGoals = m.score.fullTime.home ?? "?";
        const awayGoals = m.score.fullTime.away ?? "?";
        return `${home} ${homeGoals}-${awayGoals} ${away}`;
      });
      lines.push(matchLabels.join(" | "));
    }
    lines.push("");

    // Sort by current position
    const sorted = [...entries].sort(
      (a, b) => a.position - b.position || a.name.localeCompare(b.name),
    );

    for (const entry of sorted) {
      const yesterdayPos = yesterdayPositions.get(entry.userId) ?? entry.position;
      const posChange = yesterdayPos - entry.position; // positive = moved up

      let changeStr = "";
      if (posChange > 0) changeStr = ` (↑${posChange})`;
      else if (posChange < 0) changeStr = ` (↓${Math.abs(posChange)})`;

      const flag = nameWithFlag(entry.name, entry.country);

      // Points awarded today = match points + any bonus awarded today, shown as
      // a single figure (no separate bonus breakdown).
      const todayTotal = entry.todayMatch + entry.todayBonus;

      lines.push(
        `${entry.position}. ${flag} - ${entry.totalPoints} (+${todayTotal})${changeStr}`,
      );
    }

    return lines.join("\n");
  }, [allPredictions.content, todaysMatches, matches, todayStr, scores]);

  const handleCopyPredictions = async () => {
    const text = buildPredictionsText();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopiedPredictions(true);
    setTimeout(() => setCopiedPredictions(false), 2000);
  };

  const handleCopyPoints = async () => {
    const text = buildPointsText();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopiedPoints(true);
    setTimeout(() => setCopiedPoints(false), 2000);
  };

  const matchCount = todaysMatches.length;
  const finishedCount = todaysMatches.filter(
    (m) => m.status === "FINISHED",
  ).length;
  const liveCount = todaysMatches.filter(
    (m) => m.status === "IN_PLAY" || m.status === "PAUSED",
  ).length;

  return (
    <section className="glass-card p-6 mb-6">
      <h2 className="text-xl font-bold text-white mb-4">📋 Daily Summary</h2>

      <div className="flex items-center gap-3 mb-4 text-sm text-white/60">
        <span>{todayStr}</span>
        <span>•</span>
        <span>
          {matchCount} match{matchCount !== 1 ? "es" : ""} today
        </span>
        {finishedCount > 0 && (
          <>
            <span>•</span>
            <span className="text-emerald-400">{finishedCount} finished</span>
          </>
        )}
        {liveCount > 0 && (
          <>
            <span>•</span>
            <span className="text-amber-400">{liveCount} live</span>
          </>
        )}
      </div>

      {matchCount === 0 ? (
        <p className="text-white/40 text-sm">No matches today.</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleCopyPredictions}
            disabled={!allPredictions.content}
            className="px-4 py-2 rounded-lg text-sm font-medium transition
              bg-blue-600/20 text-blue-400 hover:bg-blue-600/30
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {copiedPredictions ? "✓ Copied!" : "📋 Copy Predictions"}
          </button>

          <button
            onClick={handleCopyPoints}
            disabled={!allPredictions.content}
            className="px-4 py-2 rounded-lg text-sm font-medium transition
              bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {copiedPoints ? "✓ Copied!" : "📊 Copy Points"}
          </button>
        </div>
      )}
    </section>
  );
}
