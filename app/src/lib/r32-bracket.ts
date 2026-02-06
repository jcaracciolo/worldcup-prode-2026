// World Cup 2026 Round of 32 Bracket Mapping
// Based on official FIFA format for 48-team World Cup
// 12 groups, top 2 + 8 best 3rd place = 32 teams

export interface R32BracketSlot {
  matchNumber: number; // FIFA match number (73-88)
  homePosition: { group: string; position: number } | null; // null for 3rd place (dynamic)
  awayPosition: { group: string; position: number } | null;
}

// R32 Bracket mapping (16 matches, numbered 73-88)
// Teams based on group positions
export const r32Bracket: R32BracketSlot[] = [
  // Match 73: Runner-up A vs Runner-up B
  {
    matchNumber: 73,
    homePosition: { group: "GROUP_A", position: 2 },
    awayPosition: { group: "GROUP_B", position: 2 },
  },
  // Match 74: Winner E vs 3rd (A/B/C/D/F)
  {
    matchNumber: 74,
    homePosition: { group: "GROUP_E", position: 1 },
    awayPosition: null, // 3rd place - determined dynamically
  },
  // Match 75: Winner F vs Runner-up C
  {
    matchNumber: 75,
    homePosition: { group: "GROUP_F", position: 1 },
    awayPosition: { group: "GROUP_C", position: 2 },
  },
  // Match 76: Winner C vs Runner-up F
  {
    matchNumber: 76,
    homePosition: { group: "GROUP_C", position: 1 },
    awayPosition: { group: "GROUP_F", position: 2 },
  },
  // Match 77: Winner I vs 3rd (C/D/F/G/H)
  {
    matchNumber: 77,
    homePosition: { group: "GROUP_I", position: 1 },
    awayPosition: null, // 3rd place - determined dynamically
  },
  // Match 78: Runner-up E vs Runner-up I
  {
    matchNumber: 78,
    homePosition: { group: "GROUP_E", position: 2 },
    awayPosition: { group: "GROUP_I", position: 2 },
  },
  // Match 79: Winner A vs 3rd (C/E/F/H/I)
  {
    matchNumber: 79,
    homePosition: { group: "GROUP_A", position: 1 },
    awayPosition: null, // 3rd place - determined dynamically
  },
  // Match 80: Winner L vs 3rd (E/H/I/J/K)
  {
    matchNumber: 80,
    homePosition: { group: "GROUP_L", position: 1 },
    awayPosition: null, // 3rd place - determined dynamically
  },
  // Match 81: Winner D vs 3rd (B/E/F/I/J)
  {
    matchNumber: 81,
    homePosition: { group: "GROUP_D", position: 1 },
    awayPosition: null, // 3rd place - determined dynamically
  },
  // Match 82: Winner G vs 3rd (A/E/H/I/J)
  {
    matchNumber: 82,
    homePosition: { group: "GROUP_G", position: 1 },
    awayPosition: null, // 3rd place - determined dynamically
  },
  // Match 83: Runner-up K vs Runner-up L
  {
    matchNumber: 83,
    homePosition: { group: "GROUP_K", position: 2 },
    awayPosition: { group: "GROUP_L", position: 2 },
  },
  // Match 84: Winner H vs Runner-up J
  {
    matchNumber: 84,
    homePosition: { group: "GROUP_H", position: 1 },
    awayPosition: { group: "GROUP_J", position: 2 },
  },
  // Match 85: Winner B vs 3rd (E/F/G/I/J)
  {
    matchNumber: 85,
    homePosition: { group: "GROUP_B", position: 1 },
    awayPosition: null, // 3rd place - determined dynamically
  },
  // Match 86: Winner J vs Runner-up H
  {
    matchNumber: 86,
    homePosition: { group: "GROUP_J", position: 1 },
    awayPosition: { group: "GROUP_H", position: 2 },
  },
  // Match 87: Winner K vs 3rd (D/E/I/J/L)
  {
    matchNumber: 87,
    homePosition: { group: "GROUP_K", position: 1 },
    awayPosition: null, // 3rd place - determined dynamically
  },
  // Match 88: Runner-up D vs Runner-up G
  {
    matchNumber: 88,
    homePosition: { group: "GROUP_D", position: 2 },
    awayPosition: { group: "GROUP_G", position: 2 },
  },
];

// R16 Bracket - which R32 matches feed into each R16 match
export interface R16BracketSlot {
  matchNumber: number; // FIFA match number (89-96)
  homeFromR32: number; // Winner of R32 match number
  awayFromR32: number; // Winner of R32 match number
}

export const r16Bracket: R16BracketSlot[] = [
  { matchNumber: 89, homeFromR32: 74, awayFromR32: 77 },
  { matchNumber: 90, homeFromR32: 73, awayFromR32: 75 },
  { matchNumber: 91, homeFromR32: 76, awayFromR32: 78 },
  { matchNumber: 92, homeFromR32: 79, awayFromR32: 80 },
  { matchNumber: 93, homeFromR32: 83, awayFromR32: 84 },
  { matchNumber: 94, homeFromR32: 81, awayFromR32: 82 },
  { matchNumber: 95, homeFromR32: 86, awayFromR32: 88 },
  { matchNumber: 96, homeFromR32: 85, awayFromR32: 87 },
];

// QF Bracket - which R16 matches feed into each QF match
export interface QFBracketSlot {
  matchNumber: number; // FIFA match number (97-100)
  homeFromR16: number;
  awayFromR16: number;
}

export const qfBracket: QFBracketSlot[] = [
  { matchNumber: 97, homeFromR16: 89, awayFromR16: 90 },
  { matchNumber: 98, homeFromR16: 93, awayFromR16: 94 },
  { matchNumber: 99, homeFromR16: 91, awayFromR16: 92 },
  { matchNumber: 100, homeFromR16: 95, awayFromR16: 96 },
];

// SF Bracket - which QF matches feed into each SF match
export interface SFBracketSlot {
  matchNumber: number; // FIFA match number (101-102)
  homeFromQF: number;
  awayFromQF: number;
}

export const sfBracket: SFBracketSlot[] = [
  { matchNumber: 101, homeFromQF: 97, awayFromQF: 98 },
  { matchNumber: 102, homeFromQF: 99, awayFromQF: 100 },
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
  matchNumber: number,
): R32BracketSlot | undefined {
  return r32Bracket.find((slot) => slot.matchNumber === matchNumber);
}

// Get R16 bracket info by match number
export function getR16BracketByNumber(
  matchNumber: number,
): R16BracketSlot | undefined {
  return r16Bracket.find((slot) => slot.matchNumber === matchNumber);
}

// Get QF bracket info by match number
export function getQFBracketByNumber(
  matchNumber: number,
): QFBracketSlot | undefined {
  return qfBracket.find((slot) => slot.matchNumber === matchNumber);
}

// Get SF bracket info by match number
export function getSFBracketByNumber(
  matchNumber: number,
): SFBracketSlot | undefined {
  return sfBracket.find((slot) => slot.matchNumber === matchNumber);
}
