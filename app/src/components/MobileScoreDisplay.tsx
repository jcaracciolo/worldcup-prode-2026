"use client";

import { FifaMatchId } from "@/types/football";

export interface ActiveField {
  matchId: FifaMatchId;
  side: "home" | "away";
}

interface MobileScoreDisplayProps {
  homeGoals: number | null;
  awayGoals: number | null;
  matchId: FifaMatchId;
  disabled: boolean;
  activeField: ActiveField | null;
  onTap: (field: ActiveField) => void;
}

/**
 * Mobile-only tappable score display replacing <input type="number">.
 * Renders two 44px+ touch targets showing the current goals.
 * When tapped, signals the parent to open the number pad for that field.
 */
export default function MobileScoreDisplay({
  homeGoals,
  awayGoals,
  matchId,
  disabled,
  activeField,
  onTap,
}: MobileScoreDisplayProps) {
  const isHomeActive =
    activeField?.matchId === matchId && activeField?.side === "home";
  const isAwayActive =
    activeField?.matchId === matchId && activeField?.side === "away";

  const baseClass =
    "w-9 h-9 flex items-center justify-center text-sm font-bold rounded transition-all select-none";

  const enabledClass = (active: boolean) =>
    active
      ? "bg-emerald-500 text-white ring-2 ring-emerald-400 scale-110"
      : "bg-white/90 text-slate-800 active:scale-95";

  const disabledClass = "bg-white/30 text-white/50";

  return (
    <div className="flex items-center gap-1 shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onTap({ matchId, side: "home" })}
        className={`${baseClass} ${disabled ? disabledClass : enabledClass(isHomeActive)}`}
      >
        {homeGoals ?? "-"}
      </button>
      <span className="text-white/50 font-bold text-xs">-</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onTap({ matchId, side: "away" })}
        className={`${baseClass} ${disabled ? disabledClass : enabledClass(isAwayActive)}`}
      >
        {awayGoals ?? "-"}
      </button>
    </div>
  );
}
