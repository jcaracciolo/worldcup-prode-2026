"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import UserName from "@/components/UserName";
import { ScoreTimeline, TimelinePlayer, PTS_SUFFIX } from "@/lib/score-timeline";

// Distinct, readable palette for player lines (current user gets a fixed color).
const PALETTE = [
  "#38bdf8", // sky
  "#f472b6", // pink
  "#a3e635", // lime
  "#fbbf24", // amber
  "#c084fc", // purple
  "#fb7185", // rose
  "#34d399", // emerald
  "#60a5fa", // blue
  "#facc15", // yellow
  "#f87171", // red
  "#2dd4bf", // teal
  "#e879f9", // fuchsia
  "#a78bfa", // violet
  "#4ade80", // green
  "#fdba74", // orange
  "#22d3ee", // cyan
];

const CURRENT_USER_COLOR = "#ffffff";

function colorFor(
  player: TimelinePlayer,
  index: number,
  currentUserId: string | null,
): string {
  if (player.userId === currentUserId) return CURRENT_USER_COLOR;
  return PALETTE[index % PALETTE.length];
}

interface ScoreTimelineChartProps {
  timeline: ScoreTimeline;
  currentUserId: string | null;
}

export default function ScoreTimelineChart({
  timeline,
  currentUserId,
}: ScoreTimelineChartProps) {
  const { rows, players } = timeline;
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const toggle = (userId: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });

  const colors = new Map(
    players.map((p, i) => [p.userId, colorFor(p, i, currentUserId)]),
  );
  const nameById = new Map(players.map((p) => [p.userId, p.name]));
  const playerCount = players.length;
  const positionTicks = Array.from({ length: playerCount }, (_, i) => i + 1);

  // Render current user's line last so it sits on top.
  const orderedPlayers = [...players].sort((a, b) => {
    if (a.userId === currentUserId) return 1;
    if (b.userId === currentUserId) return -1;
    return 0;
  });

  if (rows.length === 0 || players.length === 0) {
    return (
      <div className="p-6 sm:p-8 text-center">
        <div className="text-3xl sm:text-4xl mb-3">📈</div>
        <p className="text-white/60 text-sm sm:text-base">
          No scores yet — the graph appears once matches are played.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="h-[300px] sm:h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={rows}
            margin={{ top: 8, right: 12, bottom: 4, left: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.08)"
            />
            <XAxis
              dataKey="date"
              tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
              stroke="rgba(255,255,255,0.2)"
              minTickGap={16}
            />
            <YAxis
              reversed
              allowDecimals={false}
              domain={[1, playerCount]}
              ticks={positionTicks}
              tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
              stroke="rgba(255,255,255,0.2)"
              width={32}
              interval={0}
            />
            <Tooltip
              content={(props) => {
                const p = props as unknown as {
                  active?: boolean;
                  label?: string | number;
                  payload?: Array<{
                    dataKey?: string | number;
                    value?: number | string;
                  }>;
                };
                return (
                  <TimelineTooltip
                    active={p.active}
                    label={p.label}
                    payload={p.payload}
                    colors={colors}
                    nameById={nameById}
                    hidden={hidden}
                    currentUserId={currentUserId}
                  />
                );
              }}
            />
            {orderedPlayers.map((p) => {
              const isCurrent = p.userId === currentUserId;
              return (
                <Line
                  key={p.userId}
                  type="monotone"
                  dataKey={p.userId}
                  stroke={colors.get(p.userId)}
                  strokeWidth={isCurrent ? 3.5 : 1.5}
                  strokeOpacity={hidden.has(p.userId) ? 0 : isCurrent ? 1 : 0.7}
                  dot={
                    hidden.has(p.userId)
                      ? false
                      : {
                          r: isCurrent ? 3.5 : 2.5,
                          fill: colors.get(p.userId),
                          strokeWidth: 0,
                        }
                  }
                  activeDot={hidden.has(p.userId) ? false : { r: 5 }}
                  isAnimationActive={false}
                  hide={hidden.has(p.userId)}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Custom legend — click to toggle a line */}
      <div className="mt-4 px-4 flex flex-wrap gap-x-3 gap-y-2">
        {players.map((p) => {
          const isHidden = hidden.has(p.userId);
          const isCurrent = p.userId === currentUserId;
          return (
            <button
              key={p.userId}
              onClick={() => toggle(p.userId)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-all ${
                isHidden
                  ? "opacity-40 bg-white/5"
                  : "bg-white/10 hover:bg-white/20"
              } ${isCurrent ? "ring-1 ring-white/40" : ""}`}
              title={isHidden ? "Show line" : "Hide line"}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: colors.get(p.userId) }}
              />
              <span
                className={`text-white/80 ${isCurrent ? "font-semibold" : ""}`}
              >
                <UserName name={p.name} country={p.country} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TimelineTooltip({
  active,
  payload,
  label,
  colors,
  nameById,
  hidden,
  currentUserId,
}: {
  active?: boolean;
  payload?: Array<{
    dataKey?: string | number;
    value?: number | string;
    payload?: Record<string, number | string>;
  }>;
  label?: string | number;
  colors: Map<string, string>;
  nameById: Map<string, string>;
  hidden: Set<string>;
  currentUserId: string | null;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const rows = payload
    .filter((entry) => !hidden.has(String(entry.dataKey)))
    .map((entry) => {
      const userId = String(entry.dataKey);
      const points = Number(entry.payload?.[`${userId}${PTS_SUFFIX}`] ?? 0);
      return { userId, position: Number(entry.value ?? 0), points };
    })
    .sort((a, b) => a.position - b.position);

  if (rows.length === 0) return null;

  return (
    <div className="bg-[#0a3d36] border border-white/20 rounded-lg px-3 py-2 shadow-xl max-h-64 overflow-auto">
      <div className="text-white/60 text-[11px] mb-1">{label}</div>
      <div className="space-y-0.5">
        {rows.map((r) => (
          <div
            key={r.userId}
            className="flex items-center justify-between gap-3 text-xs"
          >
            <span className="flex items-center gap-1.5">
              <span className="text-white/40 tabular-nums w-4 text-right">
                {r.position}
              </span>
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: colors.get(r.userId) }}
              />
              <span
                className={`text-white/80 ${
                  r.userId === currentUserId ? "font-semibold" : ""
                }`}
              >
                {nameById.get(r.userId)}
              </span>
            </span>
            <span className="text-white/50 tabular-nums">{r.points} pts</span>
          </div>
        ))}
      </div>
    </div>
  );
}
