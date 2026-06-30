"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import UserName from "@/components/UserName";
import {
  computeDailySummary,
  DailyAward,
  AwardWinner,
  MatchRef,
  TeamRef,
} from "@/lib/daily-summary";
import { AllPredictions } from "@/lib/score-timeline";
import { Match } from "@/types/football";

interface Profile {
  id: string;
  display_name: string;
  country: string | null;
}

interface DailySummaryProps {
  matches: Match[];
  allPredictions: AllPredictions;
  profiles: Profile[];
  now: Date;
  /** Completed match-day keys (ascending). */
  completedDays: string[];
  currentUserId: string | null;
}

/**
 * Per-metric presentation (accent color, icon badge, gradient tint). Full
 * Tailwind class strings — no dynamic interpolation — so they survive the
 * compiler. Cards flow in a masonry layout, so width is uniform per column.
 */
const PRESENTATION: Record<
  string,
  { accent: string; badge: string; tint: string }
> = {
  "biggest-climber": {
    accent: "text-emerald-300",
    badge: "bg-emerald-500/15 ring-emerald-400/25",
    tint: "from-emerald-500/[0.08]",
  },
  "fewest-points": {
    accent: "text-slate-300",
    badge: "bg-slate-500/15 ring-slate-400/25",
    tint: "from-slate-500/[0.08]",
  },
  oracle: {
    accent: "text-teal-300",
    badge: "bg-teal-500/15 ring-teal-400/25",
    tint: "from-teal-500/[0.08]",
  },
  "lone-wolf": {
    accent: "text-pink-300",
    badge: "bg-pink-500/15 ring-pink-400/25",
    tint: "from-pink-500/[0.08]",
  },
  "rare-bullseye": {
    accent: "text-rose-300",
    badge: "bg-rose-500/15 ring-rose-400/25",
    tint: "from-rose-500/[0.08]",
  },
  sharpshooter: {
    accent: "text-sky-300",
    badge: "bg-sky-500/15 ring-sky-400/25",
    tint: "from-sky-500/[0.08]",
  },
  "against-the-grain": {
    accent: "text-orange-300",
    badge: "bg-orange-500/15 ring-orange-400/25",
    tint: "from-orange-500/[0.08]",
  },
};

export default function DailySummary({
  matches,
  allPredictions,
  profiles,
  now,
  completedDays,
  currentUserId,
}: DailySummaryProps) {
  const [index, setIndex] = useState(completedDays.length - 1);
  const safeIndex = Math.min(Math.max(index, 0), completedDays.length - 1);
  const dayKey = completedDays[safeIndex];

  // Only the SELECTED day is computed (lazy) — fast under large populations.
  const summary = useMemo(() => {
    if (!dayKey) return null;
    return computeDailySummary(matches, allPredictions, profiles, now, dayKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, allPredictions, profiles, dayKey]);

  if (!dayKey || !summary) return null;

  const canPrev = safeIndex > 0;
  const canNext = safeIndex < completedDays.length - 1;

  const hero = summary.awards.find((a) => a.key === "day-mvp") ?? null;
  const rest = summary.awards.filter((a) => a.key !== "day-mvp");

  return (
    <section className="mt-6 sm:mt-8 relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900/70 via-slate-900/40 to-slate-950/70 shadow-2xl shadow-black/40">
      {/* Ambient glow — gives the board a lit, infographic feel */}
      <div className="pointer-events-none absolute -top-24 left-1/3 w-[34rem] h-52 bg-amber-500/10 blur-3xl rounded-full" />
      <div className="pointer-events-none absolute -bottom-28 right-0 w-[28rem] h-52 bg-emerald-500/[0.06] blur-3xl rounded-full" />

      <div className="relative p-4 sm:p-6">
        {/* Branded header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-amber-500/15 ring-1 ring-amber-400/30 flex items-center justify-center text-xl shrink-0">
              📰
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300/80">
                Matchday Recap
              </div>
              <div className="text-white font-extrabold text-lg sm:text-xl leading-tight truncate">
                {summary.dayLabel}
              </div>
              <div className="text-white/40 text-xs">
                {summary.matches.length === 1
                  ? "1 match"
                  : `${summary.matches.length} matches`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <NavButton
              label="Previous day"
              onClick={() => setIndex(safeIndex - 1)}
              disabled={!canPrev}
            >
              ‹
            </NavButton>
            <NavButton
              label="Next day"
              onClick={() => setIndex(safeIndex + 1)}
              disabled={!canNext}
            >
              ›
            </NavButton>
          </div>
        </div>

        {/* Match results — chips with flags */}
        {summary.matches.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {summary.matches.map((m) => (
              <Link
                key={m.id}
                href={`/match/${m.id}`}
                className="bg-white/[0.05] hover:bg-white/[0.1] rounded-full px-2.5 py-1 transition-colors"
              >
                <MatchChip match={m} />
              </Link>
            ))}
          </div>
        )}

        {summary.awards.length === 0 ? (
          <div className="py-10 text-center text-white/40 text-sm">
            No standout results this day.
          </div>
        ) : (
          <div className="space-y-3">
            {hero && hero.winners.length > 0 && (
              <HeroBanner award={hero} currentUserId={currentUserId} />
            )}

            {rest.length > 0 && (
              <div className="columns-1 sm:columns-2 lg:columns-3 gap-2.5 sm:gap-3">
                {rest.map((award) => (
                  <Tile
                    key={award.key}
                    award={award}
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer branding — makes it read like a shareable card */}
        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-white/30">
          <span className="font-semibold tracking-wide">⚽ WorldCupProde</span>
          <span className="tabular-nums">{summary.dayLabel}</span>
        </div>
      </div>
    </section>
  );
}

function NavButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 disabled:opacity-25 disabled:cursor-default text-white/80 flex items-center justify-center text-lg transition-colors"
    >
      {children}
    </button>
  );
}

/** The day's headline award — large feature banner with a glowing badge. */
function HeroBanner({
  award,
  currentUserId,
}: {
  award: DailyAward;
  currentUserId: string | null;
}) {
  const [first, ...others] = award.winners;
  return (
    <div className="relative overflow-hidden rounded-2xl ring-1 ring-amber-400/20 bg-gradient-to-r from-amber-500/[0.14] via-amber-500/[0.05] to-transparent p-4 sm:p-5">
      <div className="flex items-center gap-3 sm:gap-5">
        <div className="w-14 h-14 sm:w-[4.5rem] sm:h-[4.5rem] rounded-full bg-amber-500/20 ring-2 ring-amber-400/30 flex items-center justify-center text-3xl sm:text-4xl shrink-0 shadow-lg shadow-amber-900/30">
          {award.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-amber-300/90 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.18em]">
            {award.title}
          </div>
          <Link
            href={`/user/${first.userId}`}
            className={`mt-0.5 inline-flex text-xl sm:text-3xl font-extrabold leading-tight hover:opacity-80 transition-opacity ${
              first.userId === currentUserId ? "text-emerald-300" : "text-white"
            }`}
          >
            <UserName name={first.name} country={first.country} />
          </Link>
          <div className="text-white/45 text-[11px] mt-0.5">
            {award.subtitle}
            {others.length > 0 && (
              <>
                {" · also "}
                {others.map((w, i) => (
                  <span key={w.userId}>
                    {i > 0 && ", "}
                    <Link
                      href={`/user/${w.userId}`}
                      className="text-white/60 hover:text-white transition-colors"
                    >
                      {w.name}
                    </Link>
                  </span>
                ))}
              </>
            )}
          </div>
        </div>
        {first.detail && (
          <div className="text-right shrink-0">
            <div className="text-3xl sm:text-5xl font-black text-amber-300 tabular-nums leading-none">
              {first.detail}
            </div>
            <div className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-amber-300/50 mt-1">
              points
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** A stat card in the board grid. */
function Tile({
  award,
  currentUserId,
}: {
  award: DailyAward;
  currentUserId: string | null;
}) {
  const pres = PRESENTATION[award.key] ?? {
    accent: "text-white",
    badge: "bg-white/10 ring-white/15",
    tint: "from-white/[0.04]",
  };

  // Group winners that share the same stat value (or the same match) onto a
  // single line: the value/match sits on the right, the names flow to the left.
  // Winners carrying their own teams (e.g. Oracle) get one line each.
  const groups: {
    key: string;
    detail?: string;
    match?: MatchRef;
    teams?: TeamRef[];
    winners: AwardWinner[];
  }[] = [];
  const byKey = new Map<string, number>(); // group key -> index in groups
  for (const w of award.winners) {
    const key = w.match
      ? `m:${w.match.id}`
      : w.teams
        ? `u:${w.userId}`
        : `d:${w.detail ?? ""}`;
    const existing = byKey.get(key);
    if (existing != null) {
      groups[existing].winners.push(w);
    } else {
      byKey.set(key, groups.length);
      groups.push({
        key,
        detail: w.detail,
        match: w.match,
        teams: w.teams,
        winners: [w],
      });
    }
  }

  // Cap the number of grouped lines; collapse the rest into "+N more".
  const MAX_GROUPS = 5;
  const shownGroups = groups.slice(0, MAX_GROUPS);
  const moreCount = groups
    .slice(MAX_GROUPS)
    .reduce((n, g) => n + g.winners.length, 0);

  return (
    <div
      className={`break-inside-avoid mb-2.5 sm:mb-3 rounded-2xl bg-gradient-to-br ${pres.tint} to-transparent ring-1 ring-white/[0.06] p-3.5 shadow-lg shadow-black/10`}
    >
      <div className="flex items-center gap-2.5 mb-2.5">
        <div
          className={`w-9 h-9 rounded-full ring-1 ${pres.badge} flex items-center justify-center text-base shrink-0`}
        >
          {award.emoji}
        </div>
        <div className="min-w-0">
          <h3 className="text-[13px] font-bold text-white leading-tight truncate">
            {award.title}
          </h3>
          <p className="text-[10px] text-white/35 leading-tight truncate">
            {award.subtitle}
          </p>
        </div>
      </div>
      <div className="space-y-1">
        {shownGroups.map((g) => (
          <GroupRow
            key={g.key}
            detail={g.detail}
            match={g.match}
            teams={g.teams}
            winners={g.winners}
            accent={pres.accent}
            currentUserId={currentUserId}
          />
        ))}
        {moreCount > 0 && (
          <div className="text-[10px] text-white/30 pl-0.5 pt-0.5">
            +{moreCount} more
          </div>
        )}
      </div>
    </div>
  );
}

/** Small inline match chip: home flag + TLA, score, away TLA + flag. */
function MatchChip({ match }: { match: MatchRef }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-white/55 tabular-nums whitespace-nowrap">
      {match.homeCrest && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={match.homeCrest}
          alt={match.homeTla}
          className="w-3.5 h-3.5 object-contain"
        />
      )}
      <span>{match.homeTla}</span>
      <span className="text-white/80 font-semibold">
        {match.homeScore}-{match.awayScore}
      </span>
      <span>{match.awayTla}</span>
      {match.awayCrest && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={match.awayCrest}
          alt={match.awayTla}
          className="w-3.5 h-3.5 object-contain"
        />
      )}
    </span>
  );
}

/** One recap line: names flow on the left, the shared stat/match sits right. */
function GroupRow({
  detail,
  match,
  teams,
  winners,
  accent,
  currentUserId,
}: {
  detail?: string;
  match?: MatchRef;
  teams?: TeamRef[];
  winners: AwardWinner[];
  accent: string;
  currentUserId: string | null;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2.5 rounded-lg px-0.5 py-0.5">
      <div className="min-w-0 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        {winners.map((w, i) => {
          const highlight = w.userId === currentUserId;
          return (
            <span key={`${w.userId}-${i}`} className="inline-flex items-center">
              {i > 0 && <span className="text-white/20 mr-1.5">·</span>}
              <Link
                href={`/user/${w.userId}`}
                className={`text-[13px] hover:underline ${
                  highlight ? "text-emerald-300 font-semibold" : "text-white/85"
                }`}
              >
                <UserName name={w.name} country={w.country} />
              </Link>
            </span>
          );
        })}
      </div>
      <span className="shrink-0 self-center">
        {match ? (
          <Link
            href={`/match/${match.id}`}
            className="hover:opacity-80 transition-opacity"
          >
            <MatchChip match={match} />
          </Link>
        ) : teams && teams.length > 0 ? (
          <TeamFlags teams={teams} />
        ) : (
          detail && (
            <span
              className={`text-[11px] tabular-nums font-bold ${accent}`}
            >
              {detail}
            </span>
          )
        )}
      </span>
    </div>
  );
}

/** A small strip of team flags (e.g. the teams an Oracle tipped) — flags only. */
function TeamFlags({ teams }: { teams: TeamRef[] }) {
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-1.5 max-w-[10rem]">
      {teams.map((t, i) =>
        t.crest ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${t.tla}-${i}`}
            src={t.crest}
            alt={t.tla}
            title={t.tla}
            className="w-4 h-4 object-contain"
          />
        ) : (
          <span
            key={`${t.tla}-${i}`}
            className="text-[10px] text-white/55 whitespace-nowrap"
          >
            {t.tla}
          </span>
        ),
      )}
    </span>
  );
}
