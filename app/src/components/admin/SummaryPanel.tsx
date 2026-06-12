"use client";

import { useState, useMemo, useCallback } from "react";
import { useMatches } from "@/contexts/MatchContext";
import { useAllPredictions } from "@/contexts/PredictionsContext";
import { useAllProfiles } from "@/contexts/UserContext";
import { useLeaderboard } from "@/contexts/LeaderboardContext";
import { useTime } from "@/contexts/TimeContext";
import { FifaMatchId } from "@/types/football";
import { calculateMatchPoints } from "@/lib/scoring";

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
  const { matches } = useMatches();
  const allPredictions = useAllPredictions();
  const profiles = useAllProfiles();
  const { scores } = useLeaderboard();
  const { getCurrentTime } = useTime();

  const [copiedPredictions, setCopiedPredictions] = useState(false);
  const [copiedPoints, setCopiedPoints] = useState(false);

  const todayStr = getCurrentTime().toLocaleDateString("en-CA");

  const todaysMatches = useMemo(
    () =>
      matches
        .filter(
          (m) => new Date(m.utcDate).toLocaleDateString("en-CA") === todayStr,
        )
        .sort(
          (a, b) =>
            new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
        ),
    [matches, todayStr],
  );

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

  // Build points text: standings + day points + position changes
  const buildPointsText = useCallback(() => {
    const predictionsMap = allPredictions.content;
    if (!predictionsMap || todaysMatches.length === 0) return "";

    // Only include finished or live matches for scoring
    const scorableMatches = todaysMatches.filter(
      (m) => m.status === "FINISHED" || m.status === "IN_PLAY" || m.status === "PAUSED",
    );

    if (scorableMatches.length === 0) {
      return `📊 Puntos del día — ${todayStr}\n\nNo hay partidos finalizados aún.`;
    }

    // Calculate today's points per user
    const dayPointsByUser = new Map<string, number>();

    predictionsMap.forEach((userData, userId) => {
      const profile = profileMap.get(userId);
      if (!profile) return;

      let dayTotal = 0;
      for (const match of scorableMatches) {
        const pred = userData.predictions.find(
          (p) => p.match_id === (match.id as FifaMatchId),
        );
        const result = calculateMatchPoints(match, pred || null);
        dayTotal += result.total;
      }

      dayPointsByUser.set(userId, dayTotal);
    });

    // Build standings with day points and position change
    // "Yesterday's position" = position if we subtract today's points
    const standingsWithDay = scores.map((s) => {
      const dayPts = dayPointsByUser.get(s.userId) ?? 0;
      return {
        userId: s.userId,
        name: s.displayName,
        country: s.country,
        position: s.position,
        totalPoints: s.totalPoints,
        dayPoints: dayPts,
        // Points without today → used to compute yesterday's rank
        pointsBeforeToday: s.totalPoints - dayPts,
      };
    });

    // Compute yesterday's positions by sorting on pointsBeforeToday
    const yesterdayOrder = [...standingsWithDay].sort(
      (a, b) => b.pointsBeforeToday - a.pointsBeforeToday || a.name.localeCompare(b.name),
    );
    // Assign positions with tie handling
    const yesterdayPositions = new Map<string, number>();
    let pos = 1;
    for (let i = 0; i < yesterdayOrder.length; i++) {
      if (i > 0 && yesterdayOrder[i].pointsBeforeToday < yesterdayOrder[i - 1].pointsBeforeToday) {
        pos = i + 1;
      }
      yesterdayPositions.set(yesterdayOrder[i].userId, pos);
    }

    const lines: string[] = [];
    lines.push(`📊 Tabla de posiciones — ${todayStr}`);

    // List which matches are included
    const matchLabels = scorableMatches.map((m) => {
      const home = m.homeTeam?.tla || "???";
      const away = m.awayTeam?.tla || "???";
      const homeGoals = m.score.fullTime.home ?? "?";
      const awayGoals = m.score.fullTime.away ?? "?";
      return `${home} ${homeGoals}-${awayGoals} ${away}`;
    });
    lines.push(matchLabels.join(" | "));
    lines.push("");

    // Sort by current position
    const sorted = [...standingsWithDay].sort(
      (a, b) => a.position - b.position || a.name.localeCompare(b.name),
    );

    for (const entry of sorted) {
      const yesterdayPos = yesterdayPositions.get(entry.userId) ?? entry.position;
      const posChange = yesterdayPos - entry.position; // positive = moved up

      let changeStr = "";
      if (posChange > 0) changeStr = ` (↑${posChange})`;
      else if (posChange < 0) changeStr = ` (↓${Math.abs(posChange)})`;

      const daySign = entry.dayPoints > 0 ? "+" : "";
      const flag = nameWithFlag(entry.name, entry.country);

      lines.push(
        `${entry.position}. ${flag} — ${entry.totalPoints} pts (${daySign}${entry.dayPoints} hoy)${changeStr}`,
      );
    }

    return lines.join("\n");
  }, [allPredictions.content, todaysMatches, profileMap, todayStr, scores]);

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
            disabled={!allPredictions.content || (finishedCount === 0 && liveCount === 0)}
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
