# Knockout Prediction Locking — Design Spec

## Problem

The current system locks **all 32 knockout predictions at once** when the first R32 match kicks off (June 28, 21:00 UTC). Users can fill in knockout predictions during the group stage, but those predictions are based on their **own predicted group standings** — not the real teams. Users are guessing matchups that don't exist yet, which feels meaningless.

Ideally, users would predict knockout matches based on **real teams**. But the last group matches finish just **1 hour** before the first R32 match, leaving almost no time to fill in 32 matches.

## Solution

**Per-match locking with a global deadline ceiling.**

Each knockout match locks at the **earlier** of:
1. Its own **kickoff time** (for R32 matches), or the kickoff of the **earliest R32 ancestor** in its bracket path (for R16+)
2. A **global knockout deadline** (tentatively July 1, 00:00 UTC — ~2 days after groups end)

This prevents information advantage (you can't see R32 results and then predict the R16 match fed by that result) while giving users extra time for the half of the bracket whose R32 matches start later.

## FIFA Schedule Context

### Group Stage Final Rounds

Groups finish on different days:

| Groups | Final matches finish |
|---|---|
| A & B | June 24, ~23:00 UTC |
| C & D | June 25, ~23:00 UTC |
| E & F | June 26, ~23:00 UTC |
| G & H | June 27, ~23:00 UTC |
| I, J, K, L | June 28, ~20:00 UTC |

All group results are needed to determine R32 matchups because the best 8 of 12 third-place teams qualify, requiring all 12 groups to be settled.

### R32 Schedule (Matches 73–88)

| Match | Date | Kickoff (UTC) |
|---|---|---|
| #73 | June 28 | 21:00 |
| #74 | June 29 | 18:00 |
| #75 | June 29 | 21:00 |
| #76 | June 29 | 00:00 |
| #77 | June 30 | 18:00 |
| #78 | June 30 | 21:00 |
| #79 | June 30 | 00:00 |
| #80 | July 1 | 18:00 |
| #81 | July 1 | 21:00 |
| #82 | July 1 | 00:00 |
| #83 | July 2 | 18:00 |
| #84 | July 2 | 21:00 |
| #85 | July 2 | 00:00 |
| #86 | July 3 | 18:00 |
| #87 | July 3 | 21:00 |
| #88 | July 3 | 00:00 |

### R16+ Schedule

| Round | Matches | Dates |
|---|---|---|
| R16 | #89–96 | July 4–7 |
| QF | #97–100 | July 9–11 |
| SF | #101–102 | July 14–15 |
| 3rd Place | #103 | July 18 |
| Final | #104 | July 19 |

## Bracket Dependencies

### R16 ← R32 Feeders

| R16 Match | Home from | Away from | Earliest feeder kickoff |
|---|---|---|---|
| #89 | W74 | W77 | June 29, 18:00 |
| #90 | W73 | W75 | **June 28, 21:00** |
| #91 | W76 | W78 | June 29, 00:00 |
| #92 | W79 | W80 | June 30, 00:00 |
| #93 | W83 | W84 | July 2, 18:00 |
| #94 | W81 | W82 | July 1, 21:00 |
| #95 | W86 | W88 | July 3, 18:00 |
| #96 | W85 | W87 | July 2, 00:00 |

### Full Cascade (QF through Final)

| Match | Fed by | Earliest R32 ancestor kickoff |
|---|---|---|
| QF #97 | W89, W90 | #73 → June 28, 21:00 |
| QF #98 | W93, W94 | #81 → July 1, 21:00 |
| QF #99 | W91, W92 | #76 → June 29, 00:00 |
| QF #100 | W95, W96 | #85 → July 2, 00:00 |
| SF #101 | W97, W98 | #73 → June 28, 21:00 |
| SF #102 | W99, W100 | #76 → June 29, 00:00 |
| 3rd #103 | L101, L102 | #73 → June 28, 21:00 |
| Final #104 | W101, W102 | #73 → June 28, 21:00 |

## Lock Time Per Match

Each match locks at: `min(earliest_R32_ancestor_kickoff, GLOBAL_KNOCKOUT_DEADLINE)`

With **global deadline = July 1, 00:00 UTC**:

### R32 Matches

| Match | Own kickoff | Locks at | Reason |
|---|---|---|---|
| #73 | June 28, 21:00 | **June 28, 21:00** | Own kickoff (before deadline) |
| #76 | June 29, 00:00 | **June 29, 00:00** | Own kickoff |
| #74 | June 29, 18:00 | **June 29, 18:00** | Own kickoff |
| #75 | June 29, 21:00 | **June 29, 21:00** | Own kickoff |
| #79 | June 30, 00:00 | **June 30, 00:00** | Own kickoff |
| #77 | June 30, 18:00 | **June 30, 18:00** | Own kickoff |
| #78 | June 30, 21:00 | **June 30, 21:00** | Own kickoff |
| #80 | July 1, 18:00 | **July 1, 00:00** | Global deadline |
| #81 | July 1, 21:00 | **July 1, 00:00** | Global deadline |
| #82 | July 1, 00:00 | **July 1, 00:00** | Global deadline (same time) |
| #83 | July 2, 18:00 | **July 1, 00:00** | Global deadline |
| #84 | July 2, 21:00 | **July 1, 00:00** | Global deadline |
| #85 | July 2, 00:00 | **July 1, 00:00** | Global deadline |
| #86 | July 3, 18:00 | **July 1, 00:00** | Global deadline |
| #87 | July 3, 21:00 | **July 1, 00:00** | Global deadline |
| #88 | July 3, 00:00 | **July 1, 00:00** | Global deadline |

### R16 Matches

| Match | Earliest R32 ancestor | Locks at | Reason |
|---|---|---|---|
| #90 | #73 → June 28, 21:00 | **June 28, 21:00** | Ancestor before deadline |
| #91 | #76 → June 29, 00:00 | **June 29, 00:00** | Ancestor before deadline |
| #89 | #74 → June 29, 18:00 | **June 29, 18:00** | Ancestor before deadline |
| #92 | #79 → June 30, 00:00 | **June 30, 00:00** | Ancestor before deadline |
| #94 | #81 → July 1, 21:00 | **July 1, 00:00** | Global deadline |
| #93 | #83 → July 2, 18:00 | **July 1, 00:00** | Global deadline |
| #96 | #85 → July 2, 00:00 | **July 1, 00:00** | Global deadline |
| #95 | #86 → July 3, 18:00 | **July 1, 00:00** | Global deadline |

### QF through Final

| Match | Earliest R32 ancestor | Locks at |
|---|---|---|
| QF #97 | #73 → June 28, 21:00 | **June 28, 21:00** |
| QF #99 | #76 → June 29, 00:00 | **June 29, 00:00** |
| QF #98 | #81 → July 1, 21:00 | **July 1, 00:00** |
| QF #100 | #85 → July 2, 00:00 | **July 1, 00:00** |
| SF #101 | #73 → June 28, 21:00 | **June 28, 21:00** |
| SF #102 | #76 → June 29, 00:00 | **June 29, 00:00** |
| 3rd #103 | #73 → June 28, 21:00 | **June 28, 21:00** |
| Final #104 | #73 → June 28, 21:00 | **June 28, 21:00** |

### Summary

| Lock time | # of matches | Which ones |
|---|---|---|
| June 28, 21:00 | **8** | R32 #73, R16 #90, QF #97, SF #101, 3rd #103, Final #104 + cascade |
| June 29, 00:00 | **4** | R32 #76, R16 #91, QF #99, SF #102 |
| June 29, 18:00 | **2** | R32 #74, R16 #89 |
| June 29, 21:00 | **1** | R32 #75 |
| June 30, 00:00 | **2** | R32 #79, R16 #92 |
| June 30, 18:00 | **1** | R32 #77 |
| June 30, 21:00 | **1** | R32 #78 |
| July 1, 00:00 (global) | **13** | R32 #80–88, R16 #93–96, QF #98, #100 |
| **Total** | **32** | |

- **17 matches** lock before the global deadline (due to early R32 ancestor kickoffs)
- **15 matches** lock at the global deadline (July 1, 00:00)

## What Happens If a User Misses a Match

If a user doesn't predict a match before its lock time, they get **0 points** for that match. They can still predict all other unlocked matches. The prediction row shows as locked/read-only with no prediction.

## Key Design Decisions

### Why per-match ancestor locking (not per-round)?

If R16 #90 (fed by R32 #73 and #75) stayed open until July 1, a user could watch match #73 play out, see who won, and make a more informed R16 prediction. That's an unfair advantage over someone who predicted R16 #90 early. Locking at the earliest feeder's kickoff prevents this.

### Why a global deadline?

Without it, users only get ~1 hour after groups end to predict half the bracket (everything that traces back to match #73). The global deadline at July 1, 00:00 gives an extra ~2 days for the half of the bracket whose R32 matches start July 1+. Those R32 results aren't known yet, so there's no information advantage.

### Why not predict-your-own-bracket (current system)?

The current system lets users fill in knockout predictions during the group stage based on their own predicted group standings. While this gives ample time, the predictions feel meaningless — you're guessing scores for matchups that may never happen.

### Scoring implications

- **R32**: No change. Position-based scoring — compare predicted vs actual scores.
- **R16+**: The `PredictionBracketResolver` that derives bracket teams from user's group predictions is **no longer needed**. Users predict against real matchups. Scoring becomes straightforward position-based comparison (same as R32/group stage). The team-based scoring logic for R16+ can be simplified or removed.

## UX Changes

### Predictions Page — Knockout Tab

- **Before groups end**: Show bracket structure with placeholder team labels (e.g., "1st A vs 2nd B"). Message: "Knockout predictions open after the group stage ends."
- **After groups end**: Show real teams. Each match is editable until its lock time.
- **Lock indicators**: Each match/section shows remaining time or a lock icon if locked.
- **Save**: Only saves predictions for matches that are still unlocked. Silently skips locked matches.

### Warning Banner

Instead of a single "X days until knockout locks" banner, show contextual messaging:
- "X knockout matches lock soon" with the next lock deadline
- Or per-section lock countdowns within the predictions page

### If user misses a prediction

- Match shows as locked with empty prediction (or a dash)
- Points breakdown shows 0 for that match
- No retroactive filling allowed

## Open Questions

1. **Global deadline**: July 1, 00:00 UTC is proposed. Should it be earlier or later? Moving it earlier means fewer matches get the extended window. Moving it later risks giving info advantage for late-starting R32 matches.

2. **R32 match #73**: Only ~1 hour window after groups end. Should we accept that most users will miss it, or is that a dealbreaker? (It's just 1 of 32 matches, worth max 6 points out of ~300+ total knockout points.)

3. **Server-side enforcement**: Currently there is NO server-side lock enforcement — locking is purely client-side. This spec should be implemented with proper RLS policies regardless of the locking strategy chosen.

4. **Migration**: Existing predictions made under the current predict-your-own-bracket system would need to be cleared or migrated when switching to this model. This only matters if predictions have already been made during a live tournament.
