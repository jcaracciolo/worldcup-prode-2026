"use client";

import Link from "next/link";
import { PointBreakdown, asFifaMatchId, Team } from "@/types/football";
import { getTeamLabel } from "@/lib/scoring";
import { getTeamDisplaySimple } from "@/lib/team-display";
import { useUserPosition } from "@/contexts/LeaderboardContext";

interface PointsBreakdownProps {
  userId: string;
}

export default function PointsBreakdown({ userId }: PointsBreakdownProps) {
  const positionInfo = useUserPosition(userId);
  const breakdown = positionInfo.userScore?.breakdown ?? [];
  const totalPoints = positionInfo.userScore?.totalPoints ?? 0;
  const getTypeLabel = (type: PointBreakdown["type"]) => {
    switch (type) {
      case "result":
      case "knockout_win":
        return "Result";
      case "knockout_lose":
        return "Result";
      case "knockout_tie":
        return "Result";
      case "goals_home":
      case "goals_away":
        return "Goals";
      case "group_advance":
        return "Advance";
      case "group_position":
        return "Position";
      default:
        return "";
    }
  };

  const getTypeBgColor = (type: PointBreakdown["type"]) => {
    switch (type) {
      case "result":
      case "knockout_win":
      case "knockout_lose":
      case "knockout_tie":
        return "bg-emerald-500/30 text-emerald-300 border-emerald-500/40";
      case "goals_home":
      case "goals_away":
        return "bg-blue-500/30 text-blue-300 border-blue-500/40";
      case "group_advance":
      case "group_position":
        return "bg-purple-500/30 text-purple-300 border-purple-500/40";
      default:
        return "bg-white/10 text-white/60 border-white/20";
    }
  };

  // Group breakdown by category
  const groupMatchPoints = breakdown.filter(
    (b) =>
      (b.type === "result" ||
        b.type === "goals_home" ||
        b.type === "goals_away") &&
      b.matchInfo?.stage === "GROUP_STAGE",
  );
  const groupBonusPoints = breakdown.filter(
    (b) => b.type === "group_advance" || b.type === "group_position",
  );
  const knockoutPoints = breakdown.filter(
    (b) =>
      (b.type === "result" ||
        b.type === "knockout_win" ||
        b.type === "knockout_lose" ||
        b.type === "knockout_tie" ||
        b.type === "goals_home" ||
        b.type === "goals_away") &&
      b.matchInfo &&
      b.matchInfo.stage !== "GROUP_STAGE",
  );

  const renderItem = (item: PointBreakdown, index: number) => {
    const isGroupBonusType =
      item.type === "group_advance" || item.type === "group_position";
    const isLive = item.isLive === true;

    // Points color based on live status
    const pointsColorClass = isLive ? "text-red-400" : "text-emerald-400";
    // Container styling for live items
    const containerClass = isLive
      ? "px-4 py-2.5 flex items-center hover:bg-red-500/10 transition-colors border-b border-white/5 last:border-0 bg-red-500/5 border-l-2 border-l-red-500"
      : "px-4 py-2.5 flex items-center hover:bg-white/5 transition-colors border-b border-white/5 last:border-0";

    // Get team display name with fallback to match ID label
    const getTeamDisplay = (
      team: Partial<Team> | undefined,
      matchId: number,
      position: "home" | "away",
    ) => {
      const fifaId = asFifaMatchId(matchId);
      return getTeamDisplaySimple(team, fifaId, position);
    };

    // For group bonus types (advance/position), show team with emoji
    if (isGroupBonusType && item.team) {
      const teamTla = getTeamLabel(item.team);
      return (
        <Link
          key={index}
          href={`/match/${item.matchId}`}
          className={`${containerClass} cursor-pointer`}
        >
          {/* Score */}
          <div className="w-14 shrink-0 text-center">
            <span className={`text-base font-black ${pointsColorClass}`}>
              {isLive && "🔴 "}+{item.points}
            </span>
          </div>
          <div className="w-px h-6 bg-white/10 mx-3" />
          {/* Reason */}
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 border ${getTypeBgColor(item.type)}`}
            >
              {getTypeLabel(item.type)}
            </span>
            <p className="text-xs text-white/60 truncate">{item.description}</p>
          </div>
          <div className="w-px h-6 bg-white/10 mx-3" />
          {/* Team */}
          <div className="flex items-center gap-2 w-24 shrink-0">
            {item.team?.crest ? (
              <img
                src={item.team.crest}
                alt={teamTla || "TBD"}
                className="w-5 h-5 object-contain"
              />
            ) : (
              <div className="w-5 h-5 bg-white/10 rounded flex items-center justify-center text-[8px] text-white/50">
                TBD
              </div>
            )}
            <span className="font-semibold text-white text-sm">
              {teamTla || getTeamDisplay(item.team, item.matchId, "home")}
            </span>
          </div>
        </Link>
      );
    }

    // For match-based points without match info
    if (!item.matchInfo) {
      return (
        <Link
          key={index}
          href={`/match/${item.matchId}`}
          className={`${containerClass} cursor-pointer`}
        >
          {/* Score */}
          <div className="w-14 shrink-0 text-center">
            <span className={`text-base font-black ${pointsColorClass}`}>
              {isLive && "🔴 "}+{item.points}
            </span>
          </div>
          <div className="w-px h-6 bg-white/10 mx-3" />
          {/* Reason */}
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 border ${getTypeBgColor(item.type)}`}
            >
              {getTypeLabel(item.type)}
            </span>
            <p className="text-xs text-white/60 truncate">{item.description}</p>
          </div>
        </Link>
      );
    }

    // Match-based layout: Score | Reason | Prediction | Result
    const homeTeam = item.matchInfo.homeTeam as Partial<Team>;
    const awayTeam = item.matchInfo.awayTeam as Partial<Team>;
    const homeTla = getTeamDisplay(homeTeam, item.matchId, "home");
    const awayTla = getTeamDisplay(awayTeam, item.matchId, "away");

    // For knockout, use predicted teams for the prediction row display
    const predHomeTeam = item.predictedTeamInfo?.homeTeam ?? homeTeam;
    const predAwayTeam = item.predictedTeamInfo?.awayTeam ?? awayTeam;
    const predHomeTla = item.predictedTeamInfo?.homeTeam
      ? getTeamDisplay(item.predictedTeamInfo.homeTeam, item.matchId, "home")
      : homeTla;
    const predAwayTla = item.predictedTeamInfo?.awayTeam
      ? getTeamDisplay(item.predictedTeamInfo.awayTeam, item.matchId, "away")
      : awayTla;

    // Prediction winner
    const predHome = item.prediction?.homeGoals;
    const predAway = item.prediction?.awayGoals;
    const hasPrediction =
      predHome !== null &&
      predHome !== undefined &&
      predAway !== null &&
      predAway !== undefined;
    const predHomeWon = hasPrediction && predHome > predAway;
    const predAwayWon = hasPrediction && predAway > predHome;
    const predDraw = hasPrediction && predHome === predAway;
    const isGroupStage = item.matchInfo.stage === "GROUP_STAGE";
    const predHomeHighlight = predHomeWon || (isGroupStage && predDraw);
    const predAwayHighlight = predAwayWon || (isGroupStage && predDraw);

    // Actual result winner
    const actualHome = item.matchInfo.homeGoals;
    const actualAway = item.matchInfo.awayGoals;
    const actualHomeWon = actualHome > actualAway;
    const actualAwayWon = actualAway > actualHome;
    const actualDraw = actualHome === actualAway;
    const actualHomeHighlight = actualHomeWon || (isGroupStage && actualDraw);
    const actualAwayHighlight = actualAwayWon || (isGroupStage && actualDraw);

    // Render team with flag - compact version
    const renderTeam = (
      team: Partial<Team> | undefined,
      tla: string,
      position: "home" | "away",
      highlight: boolean,
      loserOpacity: boolean,
    ) => (
      <div
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded shrink-0 w-16 ${position === "home" ? "justify-end" : "justify-start"} ${highlight ? "bg-amber-500/80" : ""}`}
      >
        {position === "home" && (
          <>
            <span
              className={`text-[11px] font-semibold whitespace-nowrap ${highlight ? "text-slate-900" : loserOpacity ? "text-white/40" : "text-white/70"}`}
            >
              {tla}
            </span>
            {team?.crest ? (
              <img
                src={team.crest}
                alt={tla}
                className={`w-4 h-4 object-contain shrink-0 ${loserOpacity ? "opacity-50" : ""}`}
              />
            ) : (
              <div className="w-4 h-4 bg-white/20 rounded flex items-center justify-center text-[8px] text-white/50 shrink-0">
                TBD
              </div>
            )}
          </>
        )}
        {position === "away" && (
          <>
            {team?.crest ? (
              <img
                src={team.crest}
                alt={tla}
                className={`w-4 h-4 object-contain shrink-0 ${loserOpacity ? "opacity-50" : ""}`}
              />
            ) : (
              <div className="w-4 h-4 bg-white/20 rounded flex items-center justify-center text-[8px] text-white/50 shrink-0">
                TBD
              </div>
            )}
            <span
              className={`text-[11px] font-semibold whitespace-nowrap ${highlight ? "text-slate-900" : loserOpacity ? "text-white/40" : "text-white/70"}`}
            >
              {tla}
            </span>
          </>
        )}
      </div>
    );

    return (
      <Link
        key={index}
        href={`/match/${item.matchId}`}
        className={`${containerClass} cursor-pointer`}
      >
        {/* Score */}
        <div className="w-14 shrink-0 text-center">
          <span className={`text-base font-black ${pointsColorClass}`}>
            {isLive && "🔴 "}+{item.points}
          </span>
        </div>

        <div className="w-px h-6 bg-white/10 mx-3" />

        {/* Reason */}
        <div className="w-44 shrink-0 flex items-center gap-2">
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 border ${getTypeBgColor(item.type)}`}
          >
            {getTypeLabel(item.type)}
          </span>
          {(item.type === "goals_home" || item.type === "goals_away") &&
            item.matchInfo && (
              <>
                {item.type === "goals_home" &&
                item.matchInfo.homeTeam?.crest ? (
                  <img
                    src={item.matchInfo.homeTeam.crest}
                    alt={item.matchInfo.homeTeam.tla || ""}
                    className="w-4 h-4 object-contain shrink-0"
                  />
                ) : item.type === "goals_away" &&
                  item.matchInfo.awayTeam?.crest ? (
                  <img
                    src={item.matchInfo.awayTeam.crest}
                    alt={item.matchInfo.awayTeam.tla || ""}
                    className="w-4 h-4 object-contain shrink-0"
                  />
                ) : null}
              </>
            )}
          <p className="text-[11px] text-white/60 truncate">
            {item.description}
          </p>
        </div>

        <div className="w-px h-6 bg-white/10 mx-3" />

        {/* Prediction */}
        <div className="flex items-center gap-1 shrink-0 w-[240px]">
          <span className="text-[10px] text-white/40 w-[70px] shrink-0">
            Prediction:
          </span>
          {renderTeam(
            predHomeTeam as {
              tla?: string;
              crest?: string;
              shortName?: string;
            },
            predHomeTla,
            "home",
            predHomeHighlight,
            predAwayWon,
          )}
          <span className="text-xs font-bold text-white px-1 w-8 text-center shrink-0">
            {predHome ?? "-"}-{predAway ?? "-"}
          </span>
          {renderTeam(
            predAwayTeam as {
              tla?: string;
              crest?: string;
              shortName?: string;
            },
            predAwayTla,
            "away",
            predAwayHighlight,
            predHomeWon,
          )}
        </div>

        <div className="w-px h-6 bg-white/10 mx-3" />

        {/* Result */}
        <div className="flex items-center gap-1 shrink-0 w-[200px]">
          <span
            className={`text-[10px] w-[50px] shrink-0 ${isLive ? "text-red-400" : "text-white/40"}`}
          >
            {isLive ? "Live:" : "Result:"}
          </span>
          {renderTeam(
            homeTeam,
            homeTla,
            "home",
            actualHomeHighlight,
            actualAwayWon,
          )}
          <span className="text-xs font-bold text-white px-1 w-8 text-center shrink-0">
            {actualHome}-{actualAway}
          </span>
          {renderTeam(
            awayTeam,
            awayTla,
            "away",
            actualAwayHighlight,
            actualHomeWon,
          )}
        </div>
      </Link>
    );
  };

  const renderSection = (
    title: string,
    emoji: string,
    items: PointBreakdown[],
    sectionPoints: number,
  ) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-4 last:mb-0">
        <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-white/5 to-transparent border-l-4 border-emerald-500/50">
          <span className="text-sm font-semibold text-white/80">
            {emoji} {title}
          </span>
          <span className="text-sm font-bold text-emerald-400">
            {sectionPoints} pts
          </span>
        </div>
        <div>{items.map((item, index) => renderItem(item, index))}</div>
      </div>
    );
  };

  const groupMatchPts = groupMatchPoints.reduce((sum, p) => sum + p.points, 0);
  const groupBonusPts = groupBonusPoints.reduce((sum, p) => sum + p.points, 0);
  const knockoutPts = knockoutPoints.reduce((sum, p) => sum + p.points, 0);

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 text-white px-5 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <span className="text-xl">📊</span>
          </div>
          <div>
            <h2 className="text-lg font-bold">Points Breakdown</h2>
            <p className="text-emerald-100/70 text-xs">Your earning details</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-3xl font-black">{totalPoints}</span>
          <span className="text-emerald-100/70 text-sm ml-1">pts</span>
        </div>
      </div>

      {/* Content */}
      <div className="max-h-[500px] overflow-y-auto">
        {breakdown.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-5xl mb-4 opacity-50">⏳</div>
            <p className="text-white/60 font-medium">No points earned yet</p>
            <p className="text-white/30 text-sm mt-2">
              Points are calculated when matches finish
            </p>
          </div>
        ) : (
          <div className="py-2">
            {renderSection(
              "Group Match Predictions",
              "⚽",
              groupMatchPoints,
              groupMatchPts,
            )}
            {renderSection(
              "Group Standings Bonus",
              "📈",
              groupBonusPoints,
              groupBonusPts,
            )}
            {renderSection("Knockout Stage", "⚔️", knockoutPoints, knockoutPts)}
          </div>
        )}
      </div>

      {/* Summary footer */}
      {breakdown.length > 0 && (
        <div className="border-t border-white/10 px-5 py-4 bg-gradient-to-r from-white/5 to-transparent">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-white">
                {groupMatchPts}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-white/40">
                Group
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {groupBonusPts}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-white/40">
                Bonus
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{knockoutPts}</div>
              <div className="text-[10px] uppercase tracking-wider text-white/40">
                Knockout
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
