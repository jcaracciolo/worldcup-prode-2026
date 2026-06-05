"use client";

import { ActiveField } from "@/components/MobileScoreDisplay";

interface MobileGoalPadProps {
  activeField: ActiveField;
  homeTeamName: string;
  awayTeamName: string;
  currentValue: number | null;
  onSelect: (value: number) => void;
  onClear: () => void;
  onClose: () => void;
}

/**
 * Fixed bottom number pad for mobile goal entry.
 * Shows 0–9 + Clear buttons, with context about which field is active.
 */
export default function MobileGoalPad({
  activeField,
  homeTeamName,
  awayTeamName,
  currentValue,
  onSelect,
  onClear,
  onClose,
}: MobileGoalPadProps) {
  const isHome = activeField.side === "home";
  const teamName = isHome ? homeTeamName : awayTeamName;
  const sideLabel = isHome ? "Home" : "Away";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 lg:hidden"
        onClick={onClose}
      />

      {/* Pad */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-slate-900 border-t border-white/20 rounded-t-2xl shadow-2xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs text-white/50">{sideLabel}</span>
            <span className="text-sm font-semibold text-white truncate">
              {teamName}
            </span>
            <span className="text-lg font-bold text-emerald-400 ml-1">
              {currentValue ?? "-"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/60 hover:text-white text-sm font-semibold px-3 py-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            Done
          </button>
        </div>

        {/* Number grid */}
        <div className="px-3 py-3">
          <div className="grid grid-cols-6 gap-2">
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onSelect(n)}
                className={`h-12 rounded-xl text-lg font-bold transition-all active:scale-95 ${
                  currentValue === n
                    ? "bg-emerald-500 text-white"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-6 gap-2 mt-2">
            {[6, 7, 8, 9].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onSelect(n)}
                className={`h-12 rounded-xl text-lg font-bold transition-all active:scale-95 ${
                  currentValue === n
                    ? "bg-emerald-500 text-white"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={onClear}
              className="h-12 rounded-xl text-sm font-bold bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-all active:scale-95 col-span-2"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
