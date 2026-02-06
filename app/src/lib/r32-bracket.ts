// World Cup 2026 Round of 32 Bracket Mapping
// Based on official FIFA format for 48-team World Cup
// 12 groups, top 2 + 8 best 3rd place = 32 teams

export interface R32BracketSlot {
  matchId: number;
  homePosition: { group: string; position: number };
  awayPosition: { group: string; position: number };
}

// Group pairings for R32 (groups that cross-play):
// A-B, C-D, E-F, G-H, I-J, K-L
// This ensures teams from the same group can't meet until later rounds

// R32 Bracket mapping (16 matches)
// Match IDs: 537415-537430
// Structure: 8 winners vs 3rd place, 4 winners vs runners-up, 4 runners-up vs runners-up
// 8 best 3rd place teams assumed from groups A-H (actual qualifiers determined by points)
export const r32Bracket: R32BracketSlot[] = [
  // Match 1-8: Group winners vs best 3rd place teams (8 matches with 3rd place)
  {
    matchId: 537415,
    homePosition: { group: "GROUP_A", position: 1 },
    awayPosition: { group: "GROUP_C", position: 3 },
  },
  {
    matchId: 537416,
    homePosition: { group: "GROUP_B", position: 1 },
    awayPosition: { group: "GROUP_D", position: 3 },
  },
  {
    matchId: 537417,
    homePosition: { group: "GROUP_C", position: 1 },
    awayPosition: { group: "GROUP_A", position: 3 },
  },
  {
    matchId: 537418,
    homePosition: { group: "GROUP_D", position: 1 },
    awayPosition: { group: "GROUP_B", position: 3 },
  },
  {
    matchId: 537419,
    homePosition: { group: "GROUP_E", position: 1 },
    awayPosition: { group: "GROUP_G", position: 3 },
  },
  {
    matchId: 537420,
    homePosition: { group: "GROUP_F", position: 1 },
    awayPosition: { group: "GROUP_H", position: 3 },
  },
  {
    matchId: 537421,
    homePosition: { group: "GROUP_G", position: 1 },
    awayPosition: { group: "GROUP_E", position: 3 },
  },
  {
    matchId: 537422,
    homePosition: { group: "GROUP_H", position: 1 },
    awayPosition: { group: "GROUP_F", position: 3 },
  },

  // Match 9-12: Remaining group winners vs runners-up (groups I-L)
  {
    matchId: 537423,
    homePosition: { group: "GROUP_I", position: 1 },
    awayPosition: { group: "GROUP_J", position: 2 },
  },
  {
    matchId: 537424,
    homePosition: { group: "GROUP_J", position: 1 },
    awayPosition: { group: "GROUP_I", position: 2 },
  },
  {
    matchId: 537425,
    homePosition: { group: "GROUP_K", position: 1 },
    awayPosition: { group: "GROUP_L", position: 2 },
  },
  {
    matchId: 537426,
    homePosition: { group: "GROUP_L", position: 1 },
    awayPosition: { group: "GROUP_K", position: 2 },
  },

  // Match 13-16: Runners-up cross matches (groups A-H)
  {
    matchId: 537427,
    homePosition: { group: "GROUP_A", position: 2 },
    awayPosition: { group: "GROUP_B", position: 2 },
  },
  {
    matchId: 537428,
    homePosition: { group: "GROUP_C", position: 2 },
    awayPosition: { group: "GROUP_D", position: 2 },
  },
  {
    matchId: 537429,
    homePosition: { group: "GROUP_E", position: 2 },
    awayPosition: { group: "GROUP_F", position: 2 },
  },
  {
    matchId: 537430,
    homePosition: { group: "GROUP_G", position: 2 },
    awayPosition: { group: "GROUP_H", position: 2 },
  },
];

// Helper to get human-readable position label
export function getPositionLabel(group: string, position: number): string {
  const groupLetter = group.replace("GROUP_", "");
  const positionLabel = position === 1 ? "1st" : position === 2 ? "2nd" : "3rd";
  return `${positionLabel} ${groupLetter}`;
}

// Get bracket info for a match
export function getR32BracketInfo(matchId: number): R32BracketSlot | undefined {
  return r32Bracket.find((slot) => slot.matchId === matchId);
}
