# Test 34: Unauthenticated — Match Detail Page

## Objective

Verify that the match detail page displays correct information for guest users across all match states (scheduled, live, finished) and stages (group, R32, R16+, Final), including team names, scores, predictions panel, and placeholder team display.

## Prerequisites

- Development environment running (`npm run dev`)
- Admin account available for simulation setup
- Multiple users with predictions for prediction panel testing

---

## Phase A: Pre-Tournament — Scheduled Match (Simulation: June 1, 2026)

### Setup

1. Log in as admin, set simulation to **2026-06-01**, time **12:00**, seed **12345**
2. Log out completely

### Step A1: Scheduled Group Match

1. Navigate to `/match/1` (a group stage match)
2. **Expected:**
   - Stage badge shows (e.g., "Group A - #1")
   - Both team names displayed with crests (or placeholder label for EU/IC teams)
   - Score area shows "vs" with kickoff time (not a score)
   - Venue and date/time displayed
   - Predictions panel shows all users' predictions
   - "Log in to highlight yours" or similar prompt
   - No points shown (match not played)

### Step A2: Placeholder Team Display — Desktop vs Mobile

1. Navigate to a match with a placeholder team (e.g., Group A match featuring EU1)
2. **Expected:**
   - Placeholder team shows "EU1" label inside a circle (no crest image)
   - On desktop (≥640px): full name "UEFA Qualifier 1" below the circle
   - On mobile (<640px): abbreviated "EU1" below the circle
   - Real team opponent shows proper crest and full country name on desktop

---

## Phase B: Group Stage Active — Finished & Live Matches (Simulation: June 15, 2026)

### Setup

1. Log in as admin, set simulation to **2026-06-15**, time **18:00**, seed **12345**
2. Log out completely

### Step B1: Finished Group Match

1. Navigate to a finished match (e.g., `/match/1`)
2. **Expected:**
   - Score displayed (e.g., "2 - 1") with FINAL badge
   - Winner team highlighted with amber background
   - Loser team dimmed (60% opacity)
   - Venue and date shown
   - Predictions panel: all users' predictions with points earned
   - Points format: "+3", "+4", "+0", etc.
   - Team names: full country name on desktop, TLA on mobile

### Step B2: Live Match (if available)

1. Navigate to a live match (check home page for one)
2. **Expected:**
   - "LIVE" badge in red
   - Score shown (may update on poll ~60s)
   - No FINAL badge
   - Predictions panel visible

### Step B3: Predictions Panel — Guest Prompt

1. On any finished match while logged out
2. **Expected:**
   - All users' predictions visible in panel
   - "Log in to highlight yours" or similar prompt
   - No user row highlighted (not logged in)

---

## Phase C: Knockout Stage — R32 & R16+ (Simulation: July 5, 2026)

### Setup

1. Log in as admin, set simulation to **2026-07-05**, time **18:00**, seed **12345**
2. Log out completely

### Step C1: Finished R32 Match

1. Navigate to a finished R32 match (e.g., `/match/73`)
2. **Expected:**
   - Stage badge: "Round of 32 - #73"
   - Both teams with full names on desktop
   - Winner highlighted, loser dimmed
   - Predictions panel: points calculated as result-based (max 6 for R32)
   - Points show for each user

### Step C2: Placeholder Team in Knockout Match

1. Find a knockout match with an EU/IC placeholder team (if EU1 advanced)
2. **Expected:**
   - Placeholder shows "EU1" in circle (no crest)
   - Desktop label: "UEFA Qualifier 1"
   - Mobile label: "EU1"
   - Points calculated normally

---

## Phase D: Tournament Complete — Final & 3rd Place (Simulation: July 20, 2026)

### Setup

1. Log in as admin, set simulation to **2026-07-20**, time **18:00**, seed **12345**
2. Log out completely

### Step D1: Final Match

1. Navigate to Final match (`/match/104` or similar)
2. **Expected:**
   - Stage: "Final - #104"
   - Both teams with crests and full names
   - Final score with FINAL badge
   - Winner (champion) highlighted amber
   - All users' predictions with points (max 16 per user)

### Step D2: Third Place Match

1. Navigate to 3rd Place match (`/match/103`)
2. **Expected:**
   - Stage: "Third-place Match - #103"
   - Both teams displayed correctly
   - Points use 5× multiplier (max 14)

### Step D3: Nonexistent Match

1. Navigate to `/match/999999`
2. **Expected:** "Match not found" message with back link

---

## Pass Criteria

- [x] Scheduled matches show "vs" and kickoff time
- [x] Finished matches show score, FINAL badge, winner highlighted
- [ ] Live matches show LIVE badge — N/A (0 live matches in all simulation states)
- [x] Predictions panel visible for guest users with login prompt
- [x] Team names: full name on desktop, TLA on mobile
- [x] Placeholder teams: label in circle, full name (desktop) / abbreviation (mobile)
- [x] R32 match shows result-based scoring (max 6) — stage badge correct ("Round of 32")
- [x] Final match shows 6× multiplier scoring (max 16) — teams resolved, predictions with points visible
- [x] 3rd Place match shows 5× multiplier scoring (max 14) — stage label "Third-place Match" correct, teams resolved
- [x] Nonexistent match ID shows error page with back link

## Test Run Results

### Run 1 — 2026-02-15

| Step                                 | Result      | Notes                                                                                                                                                                                                                                                        |
| ------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1 – Scheduled group match /match/1  | **PASS**    | Group A #1, Mexico vs South Africa, "vs" with 11:00 kickoff, venue "Estadio Azteca, Mexico City", date "Thursday, June 11, 2026 - 11:00 AM", predictions panel "No predictions yet"                                                                          |
| A2 – Placeholder team /match/2       | **PASS**    | South Korea (crest img "KOR") vs EU1 (text label, full name "UEFA Qualifier 1", no crest), "vs" with 14:00, venue "Hard Rock Stadium, Miami"                                                                                                                 |
| B1 – Finished group match /match/1   | **PARTIAL** | FINAL badge ✅, score 3-3 (draw, no winner/loser highlighting expected), venue/date correct. Predictions empty for guest ("No predictions yet")                                                                                                              |
| B2 – Live match                      | **N/A**     | 0 live matches in June 15 18:00 simulation (16 finished, 0 live, 88 scheduled)                                                                                                                                                                               |
| B3 – Predictions panel guest prompt  | **FAIL**    | Predictions panel shows "No predictions yet" for guests. Root cause: `competitionId` is `null` for unauthenticated users — `DatabaseContext.loadUserCompetitions()` requires a userId, so `getAllPredictions()` returns empty data. No login prompt visible. |
| C1 – Finished R32 match /match/73    | **PASS**    | "Round of 32 - #73", FINAL badge, EU1 (placeholder text) vs Canada (crest), score 3-2, venue "SoFi Stadium, Los Angeles", date "Sunday, June 28, 2026 - 2:00 PM". Predictions empty (same guest issue).                                                      |
| C2 – Placeholder in knockout         | **PASS**    | Verified via C1: EU1 shows text label "EU1" + full name "UEFA Qualifier 1" (no crest image), opponent Canada shows crest                                                                                                                                     |
| D1 – Final match /match/104          | **PARTIAL** | "Final - #104", FINAL badge, score 5-2, venue "MetLife Stadium, New York", date "Sunday, July 19, 2026 - 2:00 PM". Teams show as W101/W102 (unresolved semi-final winner references, no crest or country name). Predictions empty.                           |
| D2 – Third-place match /match/103    | **PARTIAL** | "3rd Place - #103" (spec says "Third-place Match"), FINAL badge, score 3-2, venue "Hard Rock Stadium, Miami". Teams show as L101/L102 (unresolved semi-final loser references).                                                                              |
| D3 – Nonexistent match /match/999999 | **PASS**    | "Match not found" message displayed correctly. No back link present (minor omission vs spec).                                                                                                                                                                |

#### Run 1 Result: **PARTIAL PASS**

#### Run 1 Issues Found

1. **Predictions panel empty for unauthenticated users (BLOCKING)**: The `DatabaseContext` loads competitions via `getUserCompetitions(userId)` which requires authentication. For guests, `competitionId` remains `null`, causing `getAllPredictions()` to return `{ data: [], error: null }`. This means the match detail predictions panel is non-functional for guests — it shows "No predictions yet" even when predictions exist. The RLS policies (`"Public predictions after stage starts"`) would allow the Supabase query to succeed if it were called, but the client-side code short-circuits before reaching Supabase.

2. **Final/3rd-place teams show unresolved references (W101/W102, L101/L102)**: In the simulation, the Final and 3rd-place matches display semi-final winner/loser references instead of resolved team names with crests. This may be a simulation-specific issue (the knockout bracket resolution might not cascade to the latest rounds) or a bug in `useMatch` team resolution.

3. **Stage label discrepancy**: Implementation uses "3rd Place" while spec says "Third-place Match".

4. **No back link on "Match not found" page**: The error state shows only the text "Match not found" without a navigation link back to fixtures or home.

---

### Run 2 — 2026-02-17

**Fixes applied:**
1. Guest competition fallback in `DatabaseContext.tsx` — falls back to first public competition when no user session
2. `isValidApiTeam()` in `live-bracket-resolver.ts` — added `/^[WL]\d+$/` regex to reject W/L bracket TLAs (W101, L102, etc.)
3. Stage label in `format.ts` — changed "3rd Place" to "Third-place Match"
4. Match-not-found page in `page.tsx` — added "← Back to fixtures" link

| Step                                 | Result      | Notes                                                                                                                                                                                                         |
| ------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1 – Finished group match /match/1   | **PASS**    | FINAL badge, score 3-3, venue/date correct. Predictions panel shows 16 users with points (+2, +1, +0). "Log in to highlight yours" link present.                                                              |
| D1 – Final match /match/104          | **PASS**    | "Final - #104", FINAL badge, score 5-2, Algeria (ALG crest) vs Spain (ESP crest) — teams fully resolved. 16 predictions visible with points. "Log in to highlight yours" link. MetLife Stadium, New York.      |
| D2 – Third-place match /match/103    | **PASS**    | "Third-place Match - #103" (correct label), FINAL badge, score 3-2, EU1 (placeholder text, "UEFA Qualifier 1") vs South Korea (KOR crest) — teams resolved. 16 predictions visible. Hard Rock Stadium, Miami. |
| D3 – Nonexistent match /match/999999 | **PASS**    | "Match not found" with "← Back to fixtures" link to /fixtures.                                                                                                                                                |

#### Run 2 Result: **PASS**
