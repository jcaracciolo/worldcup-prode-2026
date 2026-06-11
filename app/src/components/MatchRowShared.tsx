"use client";

import Link from "next/link";
import { Team, FifaMatchId } from "@/types/football";
import { MatchWithLiveInfo } from "@/contexts/MatchContext";
import { LocalPrediction } from "@/types/database";
import { getTeamLabel } from "@/lib/scoring";
import { getMatchInfo } from "@/lib/tournament";
import { ReactNode } from "react";
import { shortLabel } from "@/lib/team-display";

// City name to 3-letter abbreviation mapping
export const CITY_ABBREVIATIONS: Record<string, string> = {
  "Mexico City": "MXC",
  Miami: "MIA",
  Vancouver: "VAN",
  "New York": "NYC",
  "Los Angeles": "LAX",
  Dallas: "DAL",
  Houston: "HOU",
  Seattle: "SEA",
  "San Francisco": "SFO",
  Boston: "BOS",
  Monterrey: "MTY",
  Atlanta: "ATL",
  Philadelphia: "PHI",
  "Kansas City": "KAN",
  Toronto: "TOR",
  Guadalajara: "GDL",
};

// Format helpers
export function formatMatchDate(utcDate: string): string {
  return new Date(utcDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function formatMatchTime(utcDate: string): string {
  return new Date(utcDate).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getVenueAbbreviation(city: string): string {
  return CITY_ABBREVIATIONS[city] || city.substring(0, 3).toUpperCase();
}

export function getVenueFromFifaNumber(fifaMatchNumber?: FifaMatchId) {
  if (!fifaMatchNumber) return null;
  const matchInfo = getMatchInfo(fifaMatchNumber);
  return matchInfo?.venue || null;
}

// Shared component for team crest
interface TeamCrestProps {
  team: Team | null;
  /** Optional fallback label when team has no crest (e.g., "EU1", "1A") */
  fallbackLabel?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-5 h-5 text-[7px]",
  md: "w-6 h-6 text-[8px]",
  lg: "w-7 h-7 text-[10px]",
};

export function TeamCrest({
  team,
  fallbackLabel,
  size = "md",
  className = "",
}: TeamCrestProps) {
  const sizeClass = sizeClasses[size];

  if (team?.crest) {
    return (
      <img
        src={team.crest}
        alt={getTeamLabel(team)}
        className={`object-contain shrink-0 ${sizeClass.split(" ").slice(0, 2).join(" ")} ${className}`}
      />
    );
  }

  // Show fallback label, team TLA, or "TBD"
  const label = fallbackLabel || team?.tla || "TBD";
  return (
    <div
      className={`bg-white/20 rounded-full flex items-center justify-center font-bold text-white/60 shrink-0 ${sizeClass} ${className}`}
    >
      {shortLabel(label)}
    </div>
  );
}

// Date column for desktop layout
interface DateColumnProps {
  date: string;
  fifaMatchNumber?: FifaMatchId;
  /** Custom content instead of date (e.g., "FT" or "LIVE") */
  customContent?: ReactNode;
  className?: string;
}

export function DateColumn({
  date,
  fifaMatchNumber,
  customContent,
  className = "",
}: DateColumnProps) {
  return (
    <div
      className={`w-16 text-center shrink-0 pr-2 border-r border-white/10 ${className}`}
    >
      {customContent || (
        <div
          className="text-xs uppercase font-bold tracking-wide whitespace-nowrap"
          style={{ color: "var(--date-color)" }}
        >
          {formatMatchDate(date)}
        </div>
      )}
      {fifaMatchNumber && (
        <div className="text-[9px] text-white/40">#{fifaMatchNumber}</div>
      )}
    </div>
  );
}

// Time & Venue column for desktop layout
interface TimeVenueColumnProps {
  time: string;
  fifaMatchNumber?: FifaMatchId;
  className?: string;
}

export function TimeVenueColumn({
  time,
  fifaMatchNumber,
  className = "",
}: TimeVenueColumnProps) {
  const venue = getVenueFromFifaNumber(fifaMatchNumber);

  return (
    <div
      className={`w-20 shrink-0 px-2 border-r border-white/10 text-center ${className}`}
    >
      <div className="text-xs text-white/70 font-medium">
        {formatMatchTime(time)}
      </div>
      {venue && (
        <div
          className="text-[10px] font-semibold truncate"
          style={{ color: "var(--venue-color)" }}
        >
          {getVenueAbbreviation(venue.city)}
        </div>
      )}
    </div>
  );
}

// Mobile date/time/match# column
interface MobileDateColumnProps {
  date: string;
  fifaMatchNumber?: FifaMatchId;
  /** Custom content instead of date/time (e.g., "FT" or "LIVE") */
  customContent?: ReactNode;
}

export function MobileDateColumn({
  date,
  fifaMatchNumber,
  customContent,
}: MobileDateColumnProps) {
  return (
    <div className="w-14 shrink-0 pr-2 border-r border-white/10 relative flex items-center">
      {fifaMatchNumber && (
        <span className="absolute -top-1 left-0 text-[7px] text-white/30">
          #{fifaMatchNumber}
        </span>
      )}
      {customContent || (
        <div className="flex flex-col items-center leading-tight w-full">
          <span
            style={{ color: "var(--date-color)" }}
            className="text-xs font-bold"
          >
            {formatMatchDate(date)}
          </span>
          <span className="text-[10px] font-medium text-white/60">
            {formatMatchTime(date)}
          </span>
        </div>
      )}
    </div>
  );
}

// Score display (read-only)
interface ScoreDisplayProps {
  homeGoals: number | null | undefined;
  awayGoals: number | null | undefined;
  size?: "sm" | "md";
}

export function ScoreDisplay({
  homeGoals,
  awayGoals,
  size = "md",
}: ScoreDisplayProps) {
  const textClass = size === "sm" ? "w-12 text-xs" : "w-16 text-base";
  return (
    <span className={`${textClass} text-center font-bold text-white`}>
      {homeGoals ?? "-"} - {awayGoals ?? "-"}
    </span>
  );
}

// ============================================================
// Knockout Match Row — Sub-components (declared outside render)
// ============================================================

function KnockoutContentLink({
  children,
  className,
  matchId,
}: {
  children: ReactNode;
  className: string;
  matchId: number;
}) {
  return (
    <Link href={`/match/${matchId}`} prefetch={false} className={className}>
      {children}
    </Link>
  );
}

function KnockoutContentDiv({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
  matchId?: number;
}) {
  return <div className={className}>{children}</div>;
}

function KnockoutTeamButton({
  team,
  label,
  position,
  highlighted,
  isWinnerSelect,
  disabled,
  onWinnerChange,
}: {
  team: Team | null;
  label: string;
  position: "home" | "away";
  highlighted: boolean;
  isWinnerSelect: boolean;
  disabled: boolean;
  onWinnerChange: (teamId: number) => void;
}) {
  const isHome = position === "home";

  if (isWinnerSelect) {
    return (
      <button
        type="button"
        onClick={() => team?.id && onWinnerChange(team.id)}
        disabled={disabled || !team?.id}
        className={`flex items-center gap-2 px-2 py-1 rounded transition-all ${
          highlighted
            ? "bg-amber-500/80 text-slate-900 font-bold"
            : "hover:bg-white/10 text-white"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isHome ? (
          <>
            <span className="text-sm font-semibold">{label}</span>
            <TeamCrest team={team} fallbackLabel={label} size="lg" />
          </>
        ) : (
          <>
            <TeamCrest team={team} fallbackLabel={label} size="lg" />
            <span className="text-sm font-semibold">{label}</span>
          </>
        )}
      </button>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 px-2 py-1 rounded ${
        highlighted ? "bg-amber-500/80" : ""
      }`}
    >
      {isHome ? (
        <>
          <span
            className={`text-sm font-semibold ${
              highlighted ? "text-slate-900 font-bold" : "text-white"
            }`}
          >
            {label}
          </span>
          <TeamCrest team={team} fallbackLabel={label} size="lg" />
        </>
      ) : (
        <>
          <TeamCrest team={team} fallbackLabel={label} size="lg" />
          <span
            className={`text-sm font-semibold ${
              highlighted ? "text-slate-900 font-bold" : "text-white"
            }`}
          >
            {label}
          </span>
        </>
      )}
    </div>
  );
}

function KnockoutMobileTeamButton({
  team,
  label,
  position,
  highlighted,
  isWinnerSelect,
  disabled,
  onWinnerChange,
}: {
  team: Team | null;
  label: string;
  position: "home" | "away";
  highlighted: boolean;
  isWinnerSelect: boolean;
  disabled: boolean;
  onWinnerChange: (teamId: number) => void;
}) {
  const isHome = position === "home";

  if (isWinnerSelect) {
    return (
      <button
        type="button"
        onClick={() => team?.id && onWinnerChange(team.id)}
        disabled={disabled || !team?.id}
        className={`flex items-center ${isHome ? "flex-row-reverse" : ""} gap-1.5 px-1 py-0.5 rounded transition-all ${
          highlighted
            ? "bg-amber-500/80 text-slate-900"
            : "hover:bg-white/10 text-white"
        } disabled:opacity-50`}
      >
        <TeamCrest team={team} fallbackLabel={label} size="sm" />
        <span className="text-xs font-semibold">{label}</span>
      </button>
    );
  }

  return (
    <div
      className={`flex items-center ${isHome ? "flex-row-reverse" : ""} gap-1.5 px-1 py-0.5 rounded ${
        highlighted ? "bg-amber-500/80" : ""
      }`}
    >
      <TeamCrest team={team} fallbackLabel={label} size="sm" />
      <span
        className={`text-xs font-semibold ${
          highlighted ? "text-slate-900" : "text-white"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function KnockoutScoreSection({
  mobile = false,
  isEdit,
  homeGoals,
  awayGoals,
  needsWinnerSelect,
  penaltyWinner,
  disabled,
  onHomeChange,
  onAwayChange,
}: {
  mobile?: boolean;
  isEdit: boolean;
  homeGoals: number | null;
  awayGoals: number | null;
  needsWinnerSelect: boolean;
  penaltyWinner: "HOME" | "AWAY" | null;
  disabled: boolean;
  onHomeChange: (value: string) => void;
  onAwayChange: (value: string) => void;
}) {
  if (isEdit) {
    const inputClass = mobile
      ? "w-8 h-7 text-center text-sm font-bold bg-white/90 border border-white rounded text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-emerald-500 disabled:bg-white/30 disabled:text-white/50 disabled:border-white/20"
      : "w-8 h-7 text-center text-sm font-bold bg-white/90 border border-white rounded text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-400 disabled:bg-white/30 disabled:text-white/50 disabled:border-white/20 transition-all";

    return (
      <div className="flex flex-col items-center mx-1 shrink-0">
        {needsWinnerSelect && !penaltyWinner && !mobile && (
          <div className="mb-0.5 px-1 py-0.5 text-[8px] leading-tight text-center rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
            Pick winner
          </div>
        )}
        <div className="flex items-center gap-1">
          <input
            type="number"
            min="0"
            max="20"
            value={homeGoals ?? ""}
            onChange={(e) => onHomeChange(e.target.value)}
            disabled={disabled}
            className={inputClass}
            placeholder="-"
          />
          <span className="text-white/50 font-bold text-xs">-</span>
          <input
            type="number"
            min="0"
            max="20"
            value={awayGoals ?? ""}
            onChange={(e) => onAwayChange(e.target.value)}
            disabled={disabled}
            className={inputClass}
            placeholder="-"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center ${mobile ? "gap-0.5" : "gap-1"} shrink-0`}
    >
      <span
        className={`${mobile ? "w-8 h-7 text-sm" : "w-8 h-7 text-sm"} flex items-center justify-center font-bold text-white bg-white/10 rounded`}
      >
        {homeGoals ?? "-"}
      </span>
      <span className="text-white/50 font-bold text-xs">-</span>
      <span
        className={`${mobile ? "w-8 h-7 text-sm" : "w-8 h-7 text-sm"} flex items-center justify-center font-bold text-white bg-white/10 rounded`}
      >
        {awayGoals ?? "-"}
      </span>
    </div>
  );
}

// ============================================================
// Unified Knockout Match Row Component
// ============================================================

type KnockoutMatchRowMode = "edit" | "readonly";

interface KnockoutMatchRowProps {
  match: MatchWithLiveInfo;
  prediction?: LocalPrediction;
  fifaMatchNumber: FifaMatchId;
  mode: KnockoutMatchRowMode;
  // Override scores (e.g., show actual match results instead of predictions)
  scores?: { home: number | null; away: number | null };
  // Edit mode props
  onChange?: (
    fifaMatchId: FifaMatchId,
    homeGoals: number | null,
    awayGoals: number | null,
    penaltyWinner?: "HOME" | "AWAY" | null,
  ) => void;
  disabled?: boolean;
  showWinnerSelect?: boolean;
  // Readonly mode props
  pointsTooltip?: ReactNode;
}

export function KnockoutMatchRow({
  match,
  prediction,
  fifaMatchNumber,
  mode,
  scores,
  onChange,
  disabled = false,
  showWinnerSelect = false,
  pointsTooltip,
}: KnockoutMatchRowProps) {
  const homeTeam = match.homeTeam;
  const awayTeam = match.awayTeam;

  // Prediction values (or overridden scores)
  const homeGoals = scores ? scores.home : (prediction?.home_goals ?? null);
  const awayGoals = scores ? scores.away : (prediction?.away_goals ?? null);
  const penaltyWinner = prediction?.penalty_winner ?? null;

  const hasScore = homeGoals !== null && awayGoals !== null;
  const isTie = hasScore && homeGoals === awayGoals;
  const needsWinnerSelect = mode === "edit" && showWinnerSelect && isTie;

  // Determine winner highlights
  const homeWins = hasScore && homeGoals! > awayGoals!;
  const awayWins = hasScore && awayGoals! > homeGoals!;

  const homeHighlight = homeWins || (isTie && penaltyWinner === "HOME");
  const awayHighlight = awayWins || (isTie && penaltyWinner === "AWAY");

  // Edit handlers
  const handleHomeChange = (value: string) => {
    if (!onChange) return;
    const goals = value === "" ? null : parseInt(value, 10);
    if (goals !== null && (isNaN(goals) || goals < 0 || goals > 20)) return;
    onChange(fifaMatchNumber, goals, awayGoals, penaltyWinner);
  };

  const handleAwayChange = (value: string) => {
    if (!onChange) return;
    const goals = value === "" ? null : parseInt(value, 10);
    if (goals !== null && (isNaN(goals) || goals < 0 || goals > 20)) return;
    onChange(fifaMatchNumber, homeGoals, goals, penaltyWinner);
  };

  const handleWinnerChange = (teamId: number) => {
    if (!onChange) return;
    const side = teamId === homeTeam?.id ? "HOME" : "AWAY";
    onChange(fifaMatchNumber, homeGoals, awayGoals, side);
  };

  // Content wrapper - Link for readonly, div for edit
  const ContentWrapper =
    mode === "readonly" ? KnockoutContentLink : KnockoutContentDiv;

  const borderClass =
    mode === "edit" && needsWinnerSelect
      ? "border-2 border-amber-400/50"
      : "border border-white/10";

  const bgClass =
    mode === "edit"
      ? disabled
        ? "bg-slate-900/60 opacity-70"
        : "bg-slate-800/60 hover:bg-slate-800/80"
      : "bg-slate-800/60";

  return (
    <div
      className={`py-1.5 px-2 rounded-lg transition-colors overflow-visible relative ${bgClass} ${borderClass}`}
    >
      {/* Mobile Layout */}
      <div className="lg:hidden flex items-center gap-1">
        <MobileDateColumn
          date={match.utcDate}
          fifaMatchNumber={fifaMatchNumber}
        />
        <ContentWrapper
          matchId={match.id}
          className="flex-1 flex items-center justify-center gap-1 hover:bg-white/5 transition-colors rounded cursor-pointer min-w-0"
        >
          <div className="flex-1 min-w-0 flex items-center justify-end">
            <KnockoutMobileTeamButton
              team={homeTeam}
              label={match.homeDisplayName}
              position="home"
              highlighted={homeHighlight}
              isWinnerSelect={needsWinnerSelect}
              disabled={disabled}
              onWinnerChange={handleWinnerChange}
            />
          </div>
          <KnockoutScoreSection
            mobile
            isEdit={mode === "edit"}
            homeGoals={homeGoals}
            awayGoals={awayGoals}
            needsWinnerSelect={needsWinnerSelect}
            penaltyWinner={penaltyWinner}
            disabled={disabled}
            onHomeChange={handleHomeChange}
            onAwayChange={handleAwayChange}
          />
          <div className="flex-1 min-w-0 flex items-center">
            <KnockoutMobileTeamButton
              team={awayTeam}
              label={match.awayDisplayName}
              position="away"
              highlighted={awayHighlight}
              isWinnerSelect={needsWinnerSelect}
              disabled={disabled}
              onWinnerChange={handleWinnerChange}
            />
          </div>
        </ContentWrapper>
        {pointsTooltip && (
          <div className="shrink-0 w-10 text-right">{pointsTooltip}</div>
        )}
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:flex items-center gap-2">
        <ContentWrapper
          matchId={match.id}
          className="flex-1 flex items-center gap-2 hover:bg-white/5 transition-colors rounded px-1 -mx-1 cursor-pointer min-w-0"
        >
          <DateColumn date={match.utcDate} fifaMatchNumber={fifaMatchNumber} />
          <TimeVenueColumn
            time={match.utcDate}
            fifaMatchNumber={fifaMatchNumber}
          />
          <div className="flex-1 min-w-0 flex items-center justify-end">
            <KnockoutTeamButton
              team={homeTeam}
              label={match.homeDisplayName}
              position="home"
              highlighted={homeHighlight}
              isWinnerSelect={needsWinnerSelect}
              disabled={disabled}
              onWinnerChange={handleWinnerChange}
            />
          </div>
          <KnockoutScoreSection
            isEdit={mode === "edit"}
            homeGoals={homeGoals}
            awayGoals={awayGoals}
            needsWinnerSelect={needsWinnerSelect}
            penaltyWinner={penaltyWinner}
            disabled={disabled}
            onHomeChange={handleHomeChange}
            onAwayChange={handleAwayChange}
          />
          <div className="flex-1 min-w-0 flex items-center">
            <KnockoutTeamButton
              team={awayTeam}
              label={match.awayDisplayName}
              position="away"
              highlighted={awayHighlight}
              isWinnerSelect={needsWinnerSelect}
              disabled={disabled}
              onWinnerChange={handleWinnerChange}
            />
          </div>
        </ContentWrapper>
        {pointsTooltip && <div className="shrink-0">{pointsTooltip}</div>}
      </div>
    </div>
  );
}
