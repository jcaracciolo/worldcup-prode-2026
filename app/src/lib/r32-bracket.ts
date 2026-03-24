// World Cup 2026 Round of 32 Bracket Mapping
// Based on official FIFA format for 48-team World Cup
// 12 groups, top 2 + 8 best 3rd place = 32 teams

import { FifaMatchId } from "@/types/football";

export interface R32BracketSlot {
  matchNumber: FifaMatchId; // FIFA match number (73-88)
  homePosition: { group: string; position: number } | null; // null for 3rd place (dynamic)
  awayPosition: { group: string; position: number } | null;
}

// R32 Bracket mapping (16 matches, numbered 73-88)
// Teams based on group positions
export const r32Bracket: R32BracketSlot[] = [
  // Match 73: Runner-up A vs Runner-up B
  {
    matchNumber: 73 as FifaMatchId,
    homePosition: { group: "GROUP_A", position: 2 },
    awayPosition: { group: "GROUP_B", position: 2 },
  },
  // Match 74: Winner E vs 3rd (A/B/C/D/F)
  {
    matchNumber: 74 as FifaMatchId,
    homePosition: { group: "GROUP_E", position: 1 },
    awayPosition: null, // 3rd place - determined dynamically
  },
  // Match 75: Winner F vs Runner-up C
  {
    matchNumber: 75 as FifaMatchId,
    homePosition: { group: "GROUP_F", position: 1 },
    awayPosition: { group: "GROUP_C", position: 2 },
  },
  // Match 76: Winner C vs Runner-up F
  {
    matchNumber: 76 as FifaMatchId,
    homePosition: { group: "GROUP_C", position: 1 },
    awayPosition: { group: "GROUP_F", position: 2 },
  },
  // Match 77: Winner I vs 3rd (C/D/F/G/H)
  {
    matchNumber: 77 as FifaMatchId,
    homePosition: { group: "GROUP_I", position: 1 },
    awayPosition: null, // 3rd place - determined dynamically
  },
  // Match 78: Runner-up E vs Runner-up I
  {
    matchNumber: 78 as FifaMatchId,
    homePosition: { group: "GROUP_E", position: 2 },
    awayPosition: { group: "GROUP_I", position: 2 },
  },
  // Match 79: Winner A vs 3rd (C/E/F/H/I)
  {
    matchNumber: 79 as FifaMatchId,
    homePosition: { group: "GROUP_A", position: 1 },
    awayPosition: null, // 3rd place - determined dynamically
  },
  // Match 80: Winner L vs 3rd (E/H/I/J/K)
  {
    matchNumber: 80 as FifaMatchId,
    homePosition: { group: "GROUP_L", position: 1 },
    awayPosition: null, // 3rd place - determined dynamically
  },
  // Match 81: Winner D vs 3rd (B/E/F/I/J)
  {
    matchNumber: 81 as FifaMatchId,
    homePosition: { group: "GROUP_D", position: 1 },
    awayPosition: null, // 3rd place - determined dynamically
  },
  // Match 82: Winner G vs 3rd (A/E/H/I/J)
  {
    matchNumber: 82 as FifaMatchId,
    homePosition: { group: "GROUP_G", position: 1 },
    awayPosition: null, // 3rd place - determined dynamically
  },
  // Match 83: Runner-up K vs Runner-up L
  {
    matchNumber: 83 as FifaMatchId,
    homePosition: { group: "GROUP_K", position: 2 },
    awayPosition: { group: "GROUP_L", position: 2 },
  },
  // Match 84: Winner H vs Runner-up J
  {
    matchNumber: 84 as FifaMatchId,
    homePosition: { group: "GROUP_H", position: 1 },
    awayPosition: { group: "GROUP_J", position: 2 },
  },
  // Match 85: Winner B vs 3rd (E/F/G/I/J)
  {
    matchNumber: 85 as FifaMatchId,
    homePosition: { group: "GROUP_B", position: 1 },
    awayPosition: null, // 3rd place - determined dynamically
  },
  // Match 86: Winner J vs Runner-up H
  {
    matchNumber: 86 as FifaMatchId,
    homePosition: { group: "GROUP_J", position: 1 },
    awayPosition: { group: "GROUP_H", position: 2 },
  },
  // Match 87: Winner K vs 3rd (D/E/I/J/L)
  {
    matchNumber: 87 as FifaMatchId,
    homePosition: { group: "GROUP_K", position: 1 },
    awayPosition: null, // 3rd place - determined dynamically
  },
  // Match 88: Runner-up D vs Runner-up G
  {
    matchNumber: 88 as FifaMatchId,
    homePosition: { group: "GROUP_D", position: 2 },
    awayPosition: { group: "GROUP_G", position: 2 },
  },
];

// R16 Bracket - which R32 matches feed into each R16 match
export interface R16BracketSlot {
  matchNumber: FifaMatchId; // FIFA match number (89-96)
  homeFromR32: FifaMatchId; // Winner of R32 match number
  awayFromR32: FifaMatchId; // Winner of R32 match number
}

export const r16Bracket: R16BracketSlot[] = [
  {
    matchNumber: 89 as FifaMatchId,
    homeFromR32: 74 as FifaMatchId,
    awayFromR32: 77 as FifaMatchId,
  },
  {
    matchNumber: 90 as FifaMatchId,
    homeFromR32: 73 as FifaMatchId,
    awayFromR32: 75 as FifaMatchId,
  },
  {
    matchNumber: 91 as FifaMatchId,
    homeFromR32: 76 as FifaMatchId,
    awayFromR32: 78 as FifaMatchId,
  },
  {
    matchNumber: 92 as FifaMatchId,
    homeFromR32: 79 as FifaMatchId,
    awayFromR32: 80 as FifaMatchId,
  },
  {
    matchNumber: 93 as FifaMatchId,
    homeFromR32: 83 as FifaMatchId,
    awayFromR32: 84 as FifaMatchId,
  },
  {
    matchNumber: 94 as FifaMatchId,
    homeFromR32: 81 as FifaMatchId,
    awayFromR32: 82 as FifaMatchId,
  },
  {
    matchNumber: 95 as FifaMatchId,
    homeFromR32: 86 as FifaMatchId,
    awayFromR32: 88 as FifaMatchId,
  },
  {
    matchNumber: 96 as FifaMatchId,
    homeFromR32: 85 as FifaMatchId,
    awayFromR32: 87 as FifaMatchId,
  },
];

// QF Bracket - which R16 matches feed into each QF match
export interface QFBracketSlot {
  matchNumber: FifaMatchId; // FIFA match number (97-100)
  homeFromR16: FifaMatchId;
  awayFromR16: FifaMatchId;
}

export const qfBracket: QFBracketSlot[] = [
  {
    matchNumber: 97 as FifaMatchId,
    homeFromR16: 89 as FifaMatchId,
    awayFromR16: 90 as FifaMatchId,
  },
  {
    matchNumber: 98 as FifaMatchId,
    homeFromR16: 93 as FifaMatchId,
    awayFromR16: 94 as FifaMatchId,
  },
  {
    matchNumber: 99 as FifaMatchId,
    homeFromR16: 91 as FifaMatchId,
    awayFromR16: 92 as FifaMatchId,
  },
  {
    matchNumber: 100 as FifaMatchId,
    homeFromR16: 95 as FifaMatchId,
    awayFromR16: 96 as FifaMatchId,
  },
];

// SF Bracket - which QF matches feed into each SF match
export interface SFBracketSlot {
  matchNumber: FifaMatchId; // FIFA match number (101-102)
  homeFromQF: FifaMatchId;
  awayFromQF: FifaMatchId;
}

export const sfBracket: SFBracketSlot[] = [
  {
    matchNumber: 101 as FifaMatchId,
    homeFromQF: 97 as FifaMatchId,
    awayFromQF: 98 as FifaMatchId,
  },
  {
    matchNumber: 102 as FifaMatchId,
    homeFromQF: 99 as FifaMatchId,
    awayFromQF: 100 as FifaMatchId,
  },
];

// Third place: Match 103 = Loser 101 vs Loser 102
// Final: Match 104 = Winner 101 vs Winner 102

// Helper to get human-readable position label
export function getPositionLabel(group: string, position: number): string {
  const groupLetter = group.replace("GROUP_", "");
  const positionLabel = position === 1 ? "1st" : position === 2 ? "2nd" : "3rd";
  return `${positionLabel} ${groupLetter}`;
}

// Get R32 bracket info by match number
export function getR32BracketByNumber(
  matchNumber: FifaMatchId,
): R32BracketSlot | undefined {
  return r32Bracket.find((slot) => slot.matchNumber === matchNumber);
}

// Get R16 bracket info by match number
export function getR16BracketByNumber(
  matchNumber: FifaMatchId,
): R16BracketSlot | undefined {
  return r16Bracket.find((slot) => slot.matchNumber === matchNumber);
}

// Get QF bracket info by match number
export function getQFBracketByNumber(
  matchNumber: FifaMatchId,
): QFBracketSlot | undefined {
  return qfBracket.find((slot) => slot.matchNumber === matchNumber);
}

// Get SF bracket info by match number
export function getSFBracketByNumber(
  matchNumber: FifaMatchId,
): SFBracketSlot | undefined {
  return sfBracket.find((slot) => slot.matchNumber === matchNumber);
}
