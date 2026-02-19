"use client";

import { FifaMatchId } from "@/types/football";
import { ReactNode } from "react";
import {
  formatMatchDate,
  formatMatchTime,
  getVenueFromFifaNumber,
  getVenueAbbreviation,
} from "./format";

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
