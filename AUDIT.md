# Source Code Audit — `app/src/`

> Prop Drilling · Duplicate Logic · Excessive Complexity

---

## 1. Prop Drilling

Cross-file cases where a context value is fetched by a parent and passed as a prop to a child that could consume the context directly.

### P1 — `Leaderboard` receives data it could read from context

| File                         | Line(s)   |
| ---------------------------- | --------- |
| `app/page.tsx`               | 12–14, 72 |
| `components/Leaderboard.tsx` | 7–9       |

`HomePage` calls `useLeaderboard()` and `useUser()`, then threads the results into `<Leaderboard scores={leaderboard} currentUserId={profile?.id} />`. `Leaderboard` never accesses context itself — it renders exactly what the props contain.

**Fix:** Have `Leaderboard` call `useLeaderboard()` and `useUser()` internally. Remove the two props. The parent becomes a pure layout wrapper.

---

### P2 — `calculateStandings` callback threaded through `GroupStageSection`

| File                                           | Line(s)          |
| ---------------------------------------------- | ---------------- |
| `fixtures/page.tsx`                            | 52–58, 128/139   |
| `predictions/page.tsx`                         | 109–175, 600     |
| `components/predictions/GroupStageSection.tsx` | 23–24 (prop def) |

Two different pages construct two **different** `calculateStandings` implementations and pass them as a callback prop to the same child.

- **Fixtures page:** wraps `liveBracket.groupStandings.get(groupName)` — simply a context read.
- **Predictions page:** 65-line inline computation from local `predictions` + `overrides` state.

`GroupStageSection` itself has no idea how standings are produced; it just invokes the callback. This makes the data flow opaque and forces every consumer to reimplement standings logic.

**Fix:** Split `GroupStageSection` into two variants (or use a `mode` prop) — one that reads live standings from `useMatches().liveBracket`, one that calls `calculateStandingsFromPredictions` with its own `userId` via hooks. The callback prop disappears.

---

### P3 — `groups` / `knockoutStages` maps are pre-built by the parent and passed as props

| File                                              | Line(s)                              |
| ------------------------------------------------- | ------------------------------------ |
| `fixtures/page.tsx`                               | 38–47 (groups), 64–70 (knockout)     |
| `predictions/page.tsx`                            | 376–385 (groups), 396–402 (knockout) |
| `user/[userId]/page.tsx`                          | 76–84 (knockout)                     |
| `components/predictions/GroupStageSection.tsx`    | 14 (prop)                            |
| `components/predictions/KnockoutStageSection.tsx` | 12 (prop)                            |

Every parent page does the identical `matches.filter(…).forEach(…)` grouping, then passes the resulting `Map` as a prop. The children can't call `useMatches()` themselves because the map is pre-built for them.

**Fix:** Move the grouping logic into the child components (or into a shared `useGroupedMatches()` hook). Each child calls `useMatches()` directly.

---

### P4 — `UserGroupSection` receives `predictions` and `thirdPlaceQualifying` it could read via hooks

| File                              | Line(s)        |
| --------------------------------- | -------------- |
| `user/[userId]/page.tsx`          | 47, 67–69, 275 |
| `components/UserGroupSection.tsx` | 22–26          |

`UserPredictionsPage` calls `useUserPredictions(userId)` and `usePredictedMatches(userId)`, extracts `predictions` and `predictedThirdPlaceQualifying`, and passes them as props. `UserGroupSection` already receives `userId` and already calls `useMatches()` and `useUserPosition(userId)` internally — it could call `useUserPredictions(userId)` and `usePredictedMatches(userId)` as well.

**Fix:** Have `UserGroupSection` accept only `userId` and `showPredictions`, and fetch everything else internally.

---

### P5 — `PointsBreakdown` receives breakdown arrays that the parent extracts from the leaderboard context

| File                             | Line(s)    |
| -------------------------------- | ---------- |
| `user/[userId]/page.tsx`         | 86–88, 295 |
| `components/PointsBreakdown.tsx` | props      |

`UserPredictionsPage` destructures `userScore.breakdown`, `totalPoints`, `livePoints` from `useUserPosition(userId)` and passes all three as props. `PointsBreakdown` is a pure display component — this is borderline acceptable, but the parent could simply pass `userId` and let the child call `useUserPosition()`.

**Severity:** Low. Acceptable as a display component pattern — flag only if cleaning up the others.

---

## 2. Duplicate Logic

### D1 — `calculateStandingsFromPredictions` exists in **three** places

| Location               | Lines                                     | Override support |
| ---------------------- | ----------------------------------------- | ---------------- |
| `lib/standings.ts`     | 17–99                                     | ❌               |
| `lib/scoring.ts`       | 818–920                                   | ✅               |
| `predictions/page.tsx` | 109–175 + 637–654 (`createEmptyStanding`) | ✅               |

All three implement the same core algorithm: initialise team stats from matches → iterate predictions → accumulate W/D/L/GF/GA/GD/Pts → sort by points, GD, GF. The `scoring.ts` and `predictions/page.tsx` variants add manual override / tiebreaker support on top.

Additionally, `UserGroupSection` calls the `standings.ts` version (without overrides) to display predicted standings, even though `usePredictedMatches(userId)` already computes `predictedGroupStandings` (with overrides) via `PredictionBracketResolver`. This means standings are **recomputed** in `UserGroupSection` that the context already holds.

**Fix:**

1. Delete the copy in `scoring.ts` — it is now dead code since `calculateTotalPoints` delegates to `PredictionBracketResolver` for standings.
2. Delete the inline copy in `predictions/page.tsx`. Move override-aware standings calculation into `standings.ts` (add an optional `overrides` parameter to the existing function) or delegate to the `PredictionBracketResolver` that `usePredictedMatches` already uses.
3. Have `UserGroupSection` read `predictedGroupStandings` from `usePredictedMatches(userId)` instead of recomputing.

---

### D2 — Match grouping by stage / group is reimplemented in 5+ call sites

| Location                                | What it builds                         |
| --------------------------------------- | -------------------------------------- |
| `fixtures/page.tsx:38–47`               | `groups: Map<string, Match[]>`         |
| `fixtures/page.tsx:64–70`               | `knockoutStages: Map<string, Match[]>` |
| `predictions/page.tsx:376–385`          | `groups: Map<string, Match[]>`         |
| `predictions/page.tsx:396–402`          | `knockoutStages: Map<string, Match[]>` |
| `user/[userId]/page.tsx:76–84`          | `knockoutStages`                       |
| `components/UserGroupSection.tsx:57–64` | `groups`                               |

`standings.ts` already exports a `groupMatchesByGroup()` helper — **no call site uses it.** Every consumer inlines the same `filter` + `forEach` + `Map` pattern.

**Fix:** Create a `useGroupedMatches()` hook (or pair of hooks) that returns `{ groups, knockoutStages }` from contextual matches. Alternatively, expose these maps directly from `MatchContext`.

---

### D3 — `formatGroupName` / `formatStageName` duplicated in 3 files

| Location                                                | Functions                                        |
| ------------------------------------------------------- | ------------------------------------------------ |
| `components/MatchCard.tsx:48–60`                        | `formatGroupName`, `formatStageName`             |
| `app/match/[matchId]/page.tsx:107–121`                  | `formatGroupName`, `formatStageName` (identical) |
| `components/predictions/KnockoutStageSection.tsx:37–46` | `getKnockoutStageName` (subset)                  |

**Fix:** Extract to a shared utility (e.g. `lib/format.ts`) and import.

---

### D4 — `scrollToFirstLiveMatch` duplicated in 3 files

| Location                             |
| ------------------------------------ |
| `fixtures/page.tsx:29–33`            |
| `predictions/page.tsx:73–77`         |
| `components/TodaysMatches.tsx:29–33` |

Exact same 3-line `useCallback` in all three.

**Fix:** Extract to a shared hook `useLiveMatchScroller()`.

---

### D5 — Winner / highlight derivation duplicated

| Location                               | Pattern                                                          |
| -------------------------------------- | ---------------------------------------------------------------- |
| `components/MatchCard.tsx:75–86`       | `homeWon`, `awayWon`, `isDraw`, `homeHighlight`, `awayHighlight` |
| `app/match/[matchId]/page.tsx:129–147` | Same computation + `getPredictionHighlight`                      |

The same boolean derivations from `score.fullTime.home/away` and `match.status` are computed in two places, plus a prediction-specific variant.

**Fix:** Extract a `getMatchHighlight(match)` helper in a shared lib.

---

### D6 — Third-place qualifying computed redundantly

| Location                                 | How                                                            |
| ---------------------------------------- | -------------------------------------------------------------- |
| `predictions/page.tsx:388–389`           | `getQualifyingThirdPlaceTeams(groupStandings)` computed inline |
| `PredictionsContext.usePredictedMatches` | Already computes `predictedThirdPlaceQualifying`               |

The predictions page calculates `thirdPlaceQualifying` itself from freshly-computed standings, then passes it as a prop. But `usePredictedMatches()` — called on the same page for the knockout section — already computes `predictedThirdPlaceQualifying`.

**Fix:** Use `predictedThirdPlaceQualifying` from `usePredictedMatches()` instead of recomputing.

---

## 3. Overly Complex Functions / Files

### C1 — `predictions/page.tsx` — 654 lines, monolithic page

This single page component contains:

- 65-line inline `calculateStandings` (duplicate of D1)
- 8 handler functions: `handlePredictionChange`, `handleSwapPositions`, `handleSave`, `doSave`, `handleResetPredictions`, `doReset`, `handleRandomFill`, `doRandomFill`
- Complex modal / toast / error state management (4 `useState` calls)
- Validation logic with warnings aggregation inside `handleSave`
- Match grouping + standings + third-place computation
- Tab state management
- A local `createEmptyStanding` helper
- 150+ lines of JSX

**Fix:** Extract prediction editing logic into a custom hook `usePredictionEditor(userId)` that encapsulates the `predictions` state, save/reset/random-fill operations, and validation. Move `calculateStandings` to the canonical `standings.ts`. The page becomes ~200 lines of layout.

---

### C2 — `MatchRowShared.tsx` — 849 lines

Contains **10+ sub-components** in one file: `TeamCrest`, `DateColumn`, `TimeVenueColumn`, `TeamBlock`, `MobileTeamDisplay`, `ScoreDisplay`, `KnockoutMatchRow`, and more. Each sub-component is small, but the file is hard to navigate.

**Fix:** Split into a `match-row/` directory with one file per logical group (e.g. `TeamDisplay.tsx`, `ScoreDisplay.tsx`, `KnockoutMatchRow.tsx`). Keep a barrel `index.ts` for re-exports.

---

### C3 — `scoring.ts` — 1,019 lines

Mixes multiple concerns:

- Pure scoring algorithms (`calculateMatchPoints`, `calculateGroupStagePoints`, `calculateKnockoutPoints`, `calculateGroupStandingsBonusPoints`)
- A duplicate standings calculator (`calculateStandingsFromPredictions` — see D1)
- Bracket orchestration (`calculateTotalPoints` which instantiates `PredictionBracketResolver`)
- Helper utilities (`createEmptyStanding`, `isGroupStageMatch`, `getTeamLabel`, `getMaxPossiblePoints`)

**Fix:**

1. Delete the duplicate `calculateStandingsFromPredictions` (dead code after `PredictionBracketResolver` was introduced).
2. Optionally extract the helper utilities into `lib/scoring-helpers.ts`.
3. File drops to ~850 lines — still large but each function is cohesive.

---

### C4 — `match/[matchId]/page.tsx` — 300+ lines of render, `allUserPredictions` memo

The `allUserPredictions` `useMemo` (lines ~49–100) does 5 operations in a single memo: join profiles, join predictions, join centralized points, build typed objects, sort. The render section is >200 lines of JSX with inline conditional styling.

**Fix:** Extract `useMatchPredictions(matchId)` custom hook. Consider extracting the predictions panel as a separate `<MatchPredictionsPanel>` component.

---

### C5 — `admin/page.tsx` — 668 lines

Manages 5 independent admin features (competitions, invite codes, users, simulation, match stats) in one component with ~15 `useState` calls and 5 `useEffect` blocks.

**Fix:** Extract each section into its own component (`SimulationPanel`, `InviteCodeManager`, `UserManager`, `CompetitionPicker`) each managing their own state. The admin page becomes a layout shell.

---

### C6 — `UserGroupSection.tsx` — Redundant standings recomputation

`UserGroupSection` calls `calculateStandingsFromPredictions(groupMatchList, predictionMap)` (line ~107) for every group on every render. But the parent (`UserPredictionsPage`) already calls `usePredictedMatches(userId)` which returns `predictedGroupStandings` with overrides applied — these are pre-computed by `PredictionBracketResolver`.

The component does redundant work and produces standings **without** override support (the `standings.ts` version doesn't handle overrides), potentially showing different results than the scoring engine sees.

**Fix:** Pass `predictedGroupStandings` from the parent (or consume `usePredictedMatches(userId)` directly in the component via `userId` prop) and remove the local `calculateStandingsFromPredictions` call.

---

## Summary

| Category        | ID  | Severity | Effort |
| --------------- | --- | -------- | ------ |
| Prop Drilling   | P1  | Low      | 10 min |
| Prop Drilling   | P2  | High     | 1–2 hr |
| Prop Drilling   | P3  | Medium   | 30 min |
| Prop Drilling   | P4  | Medium   | 20 min |
| Prop Drilling   | P5  | Low      | 15 min |
| Duplicate Logic | D1  | **High** | 1 hr   |
| Duplicate Logic | D2  | Medium   | 30 min |
| Duplicate Logic | D3  | Low      | 10 min |
| Duplicate Logic | D4  | Low      | 5 min  |
| Duplicate Logic | D5  | Low      | 15 min |
| Duplicate Logic | D6  | Medium   | 15 min |
| Complexity      | C1  | **High** | 2 hr   |
| Complexity      | C2  | Medium   | 1 hr   |
| Complexity      | C3  | Medium   | 30 min |
| Complexity      | C4  | Low      | 30 min |
| Complexity      | C5  | Medium   | 1–2 hr |
| Complexity      | C6  | Medium   | 15 min |

### Recommended priority order

1. **D1 + C6** — Eliminate the triple `calculateStandingsFromPredictions` duplication and the redundant recomputation in `UserGroupSection`. High impact, moderate effort.
2. **P2 + P3 + D2** — Remove the `calculateStandings` callback prop and `groups`/`knockoutStages` props by creating shared hooks or consuming context in child components. Cleans up the two largest pages.
3. **C1** — Extract prediction editing logic from `predictions/page.tsx` into a custom hook.
4. **D3 + D4 + D5** — Quick wins: extract small shared utilities.
5. **C2 + C5** — File splitting for `MatchRowShared.tsx` and `admin/page.tsx`.
