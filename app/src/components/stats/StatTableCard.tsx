"use client";

import { useState } from "react";
import Link from "next/link";
import UserName from "@/components/UserName";
import { StatTable } from "@/lib/stats-tables";

const MEDALS = ["🥇", "🥈", "🥉"];

interface StatTableCardProps {
  table: StatTable;
  currentUserId: string | null;
}

export default function StatTableCard({
  table,
  currentUserId,
}: StatTableCardProps) {
  const { top, fourth, you, all, totalPlayers } = table;
  const [expanded, setExpanded] = useState(false);

  // Whether the current user already appears in the top 3 (avoid duplicate row).
  const youInTop = !!you && top.some((r) => r.userId === you.userId);

  // The extra (4th) row: the user's own standing if they're outside the top 3,
  // otherwise simply the next-ranked player so the slot is never empty.
  const extra = you && !youInTop ? you : fourth;
  const extraIsYou = !!extra && extra.userId === currentUserId;
  // Divider only when we "jump" past the 4th rank to surface a distant user.
  const extraDivider = !!extra && extra.rank > 4;

  const canExpand = all.length > top.length + (extra ? 1 : 0);

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-4 sm:px-5 py-3 border-b border-white/10 flex items-center gap-2">
        <span className="text-xl">{table.emoji}</span>
        <div className="min-w-0">
          <h3 className="text-sm sm:text-base font-bold text-white truncate">
            {table.title}
          </h3>
          <p className="text-white/40 text-[11px] leading-tight">
            {table.description}
          </p>
        </div>
      </div>

      <div className="divide-y divide-white/5">
        {all.length === 0 ? (
          <div className="px-4 py-6 text-center text-white/40 text-xs">
            No data yet
          </div>
        ) : expanded ? (
          // Full ranking
          all.map((row, i) => (
            <Row
              key={row.userId}
              rank={row.rank}
              medal={MEDALS[i]}
              userId={row.userId}
              name={row.name}
              country={row.country}
              value={row.value}
              pct={row.pct}
              highlight={row.userId === currentUserId}
            />
          ))
        ) : (
          // Collapsed: top 3 + the 4th/you row
          <>
            {top.map((row, i) => (
              <Row
                key={row.userId}
                rank={row.rank}
                medal={MEDALS[i]}
                userId={row.userId}
                name={row.name}
                country={row.country}
                value={row.value}
                pct={row.pct}
                highlight={row.userId === currentUserId}
              />
            ))}
            {extra && (
              <Row
                rank={extra.rank}
                userId={extra.userId}
                name={extra.name}
                country={extra.country}
                value={extra.value}
                pct={extra.pct}
                highlight={extraIsYou}
                divider={extraDivider}
              />
            )}
          </>
        )}
      </div>

      {canExpand && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="w-full px-4 sm:px-5 py-2 text-[11px] font-medium text-emerald-300/80 hover:text-emerald-200 hover:bg-white/5 transition-colors flex items-center justify-center gap-1"
        >
          {expanded ? "Collapse" : `See all ${totalPlayers}`}
          <span
            className={`transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            ▾
          </span>
        </button>
      )}

      {you && (
        <div className="px-4 sm:px-5 py-2 bg-white/5 text-[11px] text-white/50">
          You: <span className="text-white/80 font-semibold">{you.value}</span>
          {you.pct !== null && (
            <span className="text-white/50"> ({you.pct}%)</span>
          )}{" "}
          — {ordinal(you.rank)} of {totalPlayers}
        </div>
      )}
    </div>
  );
}

function Row({
  rank,
  medal,
  userId,
  name,
  country,
  value,
  pct,
  highlight,
  divider,
}: {
  rank: number;
  medal?: string;
  userId: string;
  name: string;
  country: string | null;
  value: number;
  pct: number | null;
  highlight?: boolean;
  divider?: boolean;
}) {
  return (
    <Link
      href={`/user/${userId}`}
      className={`flex items-center gap-2 px-4 sm:px-5 py-2 transition-colors hover:bg-white/5 ${
        highlight ? "bg-emerald-500/10" : ""
      } ${divider ? "border-t-2 border-white/10" : ""}`}
    >
      <span className="w-6 text-center text-sm shrink-0">
        {medal ?? <span className="text-white/40 text-xs">{rank}</span>}
      </span>
      <span
        className={`flex-1 min-w-0 text-sm truncate ${
          highlight ? "text-emerald-300 font-medium" : "text-white/80"
        }`}
      >
        <UserName name={name} country={country} />
      </span>
      {pct !== null && (
        <span className="text-[11px] text-white/40 tabular-nums shrink-0">
          {pct}%
        </span>
      )}
      <span className="text-sm font-semibold text-white tabular-nums shrink-0 w-7 text-right">
        {value}
      </span>
    </Link>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
