"use client";

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
