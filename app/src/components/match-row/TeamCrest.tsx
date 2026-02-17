"use client";

import { Team } from "@/types/football";
import { getTeamLabel, shortLabel } from "@/lib/team-display";

interface TeamCrestProps {
  team: Team | null;
  /** Optional fallback label when team has no crest (e.g., "EU1", "1A") */
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
      {shortLabel(label)}
    </div>
  );
}
