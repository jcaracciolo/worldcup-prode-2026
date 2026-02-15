"use client";

import Link from "next/link";
import { Team, FifaMatchId, Match } from "@/types/football";
import { LocalPrediction } from "@/types/database";
import { getTeamLabel } from "@/lib/scoring";
import { getMatchInfo } from "@/lib/tournament";
import { ReactNode } from "react";
import {
  getTeamDisplay,
  getTeamDisplaySimple,
  type TeamDisplay,
} from "@/lib/team-display";

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
  /** Optional fallback label when team has no crest (e.g., "PO1", "1A") */
  fallbackLabel?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-4 h-4 text-[6px]",
  md: "w-5 h-5 text-[8px]",
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
      {label.slice(0, 3)}
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
    <div className="w-14 shrink-0 pr-2 border-r border-white/10 relative">
      {fifaMatchNumber && (
        <span className="absolute -top-1 left-0 text-[7px] text-white/30">
          #{fifaMatchNumber}
        </span>
      )}
      {customContent || (
        <div className="flex flex-col items-center leading-tight pt-1">
          <span
            style={{ color: "var(--date-color)" }}
            className="text-xs font-bold"
          >
            {formatMatchDate(date)}
          </span>
          <span
            style={{ color: "var(--date-color)" }}
            className="text-[10px] font-medium"
          >
            {formatMatchTime(date)}
          </span>
        </div>
      )}
    </div>
  );
}

// Team name display component
interface TeamNameProps {
  team: Team | null;
  matchId: number;
  position: "home" | "away";
  fifaMatchNumber?: FifaMatchId;
  highlighted?: boolean;
  size?: "sm" | "md";
  useTla?: boolean;
}

export function TeamName({
  team,
  matchId,
  position,
  fifaMatchNumber,
  highlighted = false,
  size = "md",
  useTla = false,
}: TeamNameProps) {
  const textSize = size === "sm" ? "text-[10px]" : "text-sm";
  const display = getTeamDisplaySimple(
    team,
    matchId,
    position,
    fifaMatchNumber,
  );
  const name = useTla && team?.tla ? team.tla : display.label;

  return (
    <span
      className={`${textSize} font-semibold truncate ${
        highlighted ? "text-slate-900" : "text-white/80"
      }`}
    >
      {name}
    </span>
  );
}

// Combined team display (crest + name) for desktop
interface TeamBlockProps {
  team: Team | null;
  matchId: number;
  position: "home" | "away";
  fifaMatchNumber?: FifaMatchId;
  highlighted?: boolean;
  className?: string;
}

export function TeamBlock({
  team,
  matchId,
  position,
  fifaMatchNumber,
  highlighted = false,
  className = "",
}: TeamBlockProps) {
  const isHome = position === "home";

  return (
    <div
      className={`flex-1 flex items-center ${isHome ? "justify-end" : ""} gap-1.5 px-1.5 py-0.5 rounded ${
        highlighted ? "bg-amber-500/80" : ""
      } ${className}`}
    >
      {isHome ? (
        <>
          <TeamName
            team={team}
            matchId={matchId}
            position={position}
            fifaMatchNumber={fifaMatchNumber}
            highlighted={highlighted}
          />
          <TeamCrest team={team} size="md" />
        </>
      ) : (
        <>
          <TeamCrest team={team} size="md" />
          <TeamName
            team={team}
            matchId={matchId}
            position={position}
            fifaMatchNumber={fifaMatchNumber}
            highlighted={highlighted}
          />
        </>
      )}
    </div>
  );
}

// Mobile team display (smaller sizes)
interface MobileTeamDisplayProps {
  team: Team | null;
  matchId: number;
  position: "home" | "away";
  fifaMatchNumber?: FifaMatchId;
  highlighted?: boolean;
  useTla?: boolean;
}

export function MobileTeamDisplay({
  team,
  matchId,
  position,
  fifaMatchNumber,
  highlighted = false,
  useTla = true,
}: MobileTeamDisplayProps) {
  const isHome = position === "home";

  return (
    <div
      className={`flex-1 flex items-center ${isHome ? "justify-end" : ""} gap-1 px-1 py-0.5 rounded ${
        highlighted ? "bg-amber-500/80" : ""
      }`}
    >
      {isHome ? (
        <>
          <TeamName
            team={team}
            matchId={matchId}
            position={position}
            fifaMatchNumber={fifaMatchNumber}
            highlighted={highlighted}
            size="sm"
            useTla={useTla}
          />
          <TeamCrest team={team} size="sm" />
        </>
      ) : (
        <>
          <TeamCrest team={team} size="sm" />
          <TeamName
            team={team}
            matchId={matchId}
            position={position}
            fifaMatchNumber={fifaMatchNumber}
            highlighted={highlighted}
            size="sm"
            useTla={useTla}
          />
        </>
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
// Unified Knockout Match Row Component
// ============================================================

interface ResolvedTeams {
  home: Team | null;
  away: Team | null;
}

type KnockoutMatchRowMode = "edit" | "readonly";

interface KnockoutMatchRowProps {
  match: Match;
  prediction?: LocalPrediction;
  /** Resolved teams for this match (from useKnockoutTeams hook) */
  resolvedTeams?: ResolvedTeams;
  fifaMatchNumber: FifaMatchId;
  mode: KnockoutMatchRowMode;
  // Override scores (e.g., show actual match results instead of predictions)
  scores?: { home: number | null; away: number | null };
  // Edit mode props
  onChange?: (
    fifaMatchId: FifaMatchId,
    homeGoals: number | null,
    awayGoals: number | null,
    winnerId?: number | null,
  ) => void;
  disabled?: boolean;
  showWinnerSelect?: boolean;
  // Readonly mode props
  pointsTooltip?: ReactNode;
}

export function KnockoutMatchRow({
  match,
  prediction,
  resolvedTeams,
  fifaMatchNumber,
  mode,
  scores,
  onChange,
  disabled = false,
  showWinnerSelect = false,
  pointsTooltip,
}: KnockoutMatchRowProps) {
  // Use getTeamDisplay for consistent team resolution
  const homeDisplay = getTeamDisplay({
    match,
    position: "home",
    resolvedTeams,
  });
  const awayDisplay = getTeamDisplay({
    match,
    position: "away",
    resolvedTeams,
  });

  const homeTeam = homeDisplay.team;
  const awayTeam = awayDisplay.team;

  // Prediction values (or overridden scores)
  const homeGoals = scores ? scores.home : (prediction?.home_goals ?? null);
  const awayGoals = scores ? scores.away : (prediction?.away_goals ?? null);
  const winnerId = prediction?.winner_id ?? null;

  const hasScore = homeGoals !== null && awayGoals !== null;
  const isTie = hasScore && homeGoals === awayGoals;
  const needsWinnerSelect = mode === "edit" && showWinnerSelect && isTie;

  // Determine winner highlights
  const homeWins = hasScore && homeGoals! > awayGoals!;
  const awayWins = hasScore && awayGoals! > homeGoals!;

  const homeHighlight = homeWins || (isTie && winnerId === homeTeam?.id);
  const awayHighlight = awayWins || (isTie && winnerId === awayTeam?.id);

  // Edit handlers
  const handleHomeChange = (value: string) => {
    if (!onChange) return;
    const goals = value === "" ? null : parseInt(value, 10);
    if (goals !== null && (isNaN(goals) || goals < 0)) return;
    onChange(fifaMatchNumber, goals, awayGoals, winnerId);
  };

  const handleAwayChange = (value: string) => {
    if (!onChange) return;
    const goals = value === "" ? null : parseInt(value, 10);
    if (goals !== null && (isNaN(goals) || goals < 0)) return;
    onChange(fifaMatchNumber, homeGoals, goals, winnerId);
  };

  const handleWinnerChange = (teamId: number) => {
    if (!onChange) return;
    onChange(fifaMatchNumber, homeGoals, awayGoals, teamId);
  };

  // Content wrapper - Link for readonly, div for edit
  const ContentWrapper =
    mode === "readonly"
      ? ({
          children,
          className,
        }: {
          children: ReactNode;
          className: string;
        }) => (
          <Link href={`/match/${match.id}`} className={className}>
            {children}
          </Link>
        )
      : ({
          children,
          className,
        }: {
          children: ReactNode;
          className: string;
        }) => <div className={className}>{children}</div>;

  // Team button/display for edit mode
  const TeamButton = ({
    teamDisplay,
    position,
    highlighted,
  }: {
    teamDisplay: TeamDisplay;
    position: "home" | "away";
    highlighted: boolean;
  }) => {
    const isHome = position === "home";
    const { team, label, isPlaceholder } = teamDisplay;

    if (mode === "edit" && needsWinnerSelect) {
      return (
        <button
          type="button"
          onClick={() => team?.id && handleWinnerChange(team.id)}
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
              <TeamCrest
                team={team}
                fallbackLabel={isPlaceholder ? label : undefined}
                size="lg"
              />
            </>
          ) : (
            <>
              <TeamCrest
                team={team}
                fallbackLabel={isPlaceholder ? label : undefined}
                size="lg"
              />
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
            <TeamCrest
              team={team}
              fallbackLabel={isPlaceholder ? label : undefined}
              size="lg"
            />
          </>
        ) : (
          <>
            <TeamCrest
              team={team}
              fallbackLabel={isPlaceholder ? label : undefined}
              size="lg"
            />
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
  };

  // Mobile team display
  const MobileTeamButton = ({
    teamDisplay,
    position,
    highlighted,
  }: {
    teamDisplay: TeamDisplay;
    position: "home" | "away";
    highlighted: boolean;
  }) => {
    const isHome = position === "home";
    const { team, label, isPlaceholder } = teamDisplay;

    if (mode === "edit" && needsWinnerSelect) {
      return (
        <button
          type="button"
          onClick={() => team?.id && handleWinnerChange(team.id)}
          disabled={disabled || !team?.id}
          className={`flex items-center ${isHome ? "flex-row-reverse" : ""} gap-1 px-1 py-0.5 rounded transition-all ${
            highlighted
              ? "bg-amber-500/80 text-slate-900"
              : "hover:bg-white/10 text-white"
          } disabled:opacity-50`}
        >
          <TeamCrest
            team={team}
            fallbackLabel={isPlaceholder ? label : undefined}
            size="sm"
          />
          <span className="text-xs font-semibold">{label}</span>
        </button>
      );
    }

    return (
      <div
        className={`flex items-center ${isHome ? "flex-row-reverse" : ""} gap-1 px-1 py-0.5 rounded ${
          highlighted ? "bg-amber-500/80" : ""
        }`}
      >
        <TeamCrest
          team={team}
          fallbackLabel={isPlaceholder ? label : undefined}
          size="sm"
        />
        <span
          className={`text-xs font-semibold ${
            highlighted ? "text-slate-900" : "text-white"
          }`}
        >
          {label}
        </span>
      </div>
    );
  };

  // Score section
  const ScoreSection = ({ mobile = false }: { mobile?: boolean }) => {
    if (mode === "edit") {
      const inputClass = mobile
        ? "w-7 h-6 text-center text-xs font-bold bg-white/90 border border-white rounded text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-emerald-500 disabled:bg-white/30 disabled:text-white/50 disabled:border-white/20"
        : "w-8 h-7 text-center text-sm font-bold bg-white/90 border border-white rounded text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-400 disabled:bg-white/30 disabled:text-white/50 disabled:border-white/20 transition-all";

      return (
        <div className="flex flex-col items-center mx-1 shrink-0">
          {needsWinnerSelect && !winnerId && !mobile && (
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
              onChange={(e) => handleHomeChange(e.target.value)}
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
              onChange={(e) => handleAwayChange(e.target.value)}
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
          className={`${mobile ? "w-7 h-6 text-xs" : "w-8 h-7 text-sm"} flex items-center justify-center font-bold text-white bg-white/10 rounded`}
        >
          {homeGoals ?? "-"}
        </span>
        <span className="text-white/50 font-bold text-xs">-</span>
        <span
          className={`${mobile ? "w-7 h-6 text-xs" : "w-8 h-7 text-sm"} flex items-center justify-center font-bold text-white bg-white/10 rounded`}
        >
          {awayGoals ?? "-"}
        </span>
      </div>
    );
  };

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
      className={`py-1.5 px-2 rounded-lg transition-colors overflow-hidden ${bgClass} ${borderClass}`}
    >
      {/* Mobile Layout */}
      <div className="lg:hidden flex items-center gap-1">
        <MobileDateColumn
          date={match.utcDate}
          fifaMatchNumber={fifaMatchNumber}
        />
        <ContentWrapper className="flex-1 flex items-center justify-center gap-1 hover:bg-white/5 transition-colors rounded cursor-pointer min-w-0">
          <div className="flex-1 min-w-0 flex items-center justify-end">
            <MobileTeamButton
              teamDisplay={homeDisplay}
              position="home"
              highlighted={homeHighlight}
            />
          </div>
          <ScoreSection mobile />
          <div className="flex-1 min-w-0 flex items-center">
            <MobileTeamButton
              teamDisplay={awayDisplay}
              position="away"
              highlighted={awayHighlight}
            />
          </div>
        </ContentWrapper>
        {pointsTooltip && <div className="shrink-0">{pointsTooltip}</div>}
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:flex items-center gap-2">
        <ContentWrapper className="flex-1 flex items-center gap-2 hover:bg-white/5 transition-colors rounded px-1 -mx-1 cursor-pointer min-w-0">
          <DateColumn date={match.utcDate} fifaMatchNumber={fifaMatchNumber} />
          <TimeVenueColumn
            time={match.utcDate}
            fifaMatchNumber={fifaMatchNumber}
          />
          <div className="flex-1 min-w-0 flex items-center justify-end">
            <TeamButton
              teamDisplay={homeDisplay}
              position="home"
              highlighted={homeHighlight}
            />
          </div>
          <ScoreSection />
          <div className="flex-1 min-w-0 flex items-center">
            <TeamButton
              teamDisplay={awayDisplay}
              position="away"
              highlighted={awayHighlight}
            />
          </div>
        </ContentWrapper>
        {pointsTooltip && <div className="shrink-0">{pointsTooltip}</div>}
      </div>
    </div>
  );
}
