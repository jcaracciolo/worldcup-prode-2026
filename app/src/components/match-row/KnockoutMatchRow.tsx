"use client";

import Link from "next/link";
import { Team, FifaMatchId } from "@/types/football";
import { MatchWithLiveInfo } from "@/contexts/MatchContext";
import { LocalPrediction } from "@/types/database";
import { ReactNode } from "react";
import { TeamCrest } from "./TeamCrest";
import { DateColumn, TimeVenueColumn, MobileDateColumn } from "./DateColumns";

// ── Content wrappers ────────────────────────────────────────────────

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
    <Link href={`/match/${matchId}`} className={className}>
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

// ── Team buttons ────────────────────────────────────────────────────

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
        className={`flex items-center ${isHome ? "flex-row-reverse" : ""} gap-1 px-1 py-0.5 rounded transition-all ${
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
      className={`flex items-center ${isHome ? "flex-row-reverse" : ""} gap-1 px-1 py-0.5 rounded ${
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

// ── Score section ───────────────────────────────────────────────────

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
      ? "w-7 h-6 text-center text-xs font-bold bg-white/90 border border-white rounded text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-emerald-500 disabled:bg-white/30 disabled:text-white/50 disabled:border-white/20"
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
}

// ── Main component ──────────────────────────────────────────────────

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
