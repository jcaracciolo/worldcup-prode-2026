# Match Display Logic

How teams and scores are resolved and shown across every match-display surface in the app.

---

## 1. Data Pipeline

### 1.1 API Layer (`/api/matches`)

```
FIFA API response
  → resolveAllTbdTeams()    ← replaces null teams with placeholder objects
                               (EU1–EU4 for UEFA qualifiers, IC1–IC2 for intercontinental)
                               using synthetic negative IDs (-1001, -2001, etc.)
  → rawMatches              ← all 104 matches have team objects (some with negative IDs)
```

### 1.2 MatchContext (`app/src/contexts/MatchContext.tsx`)

```
rawMatches (from API, with TBD placeholders already resolved)
  → applySimulation()
  → processedMatches              ← "raw" knockout teams (placeholders or API originals)
  → actualGroupStandings          ← computed from processedMatches
  → actualThirdPlaceQualifying    ← computed from actualGroupStandings
  → resolvedKnockoutTeams         ← BracketResolver(processedMatches, NO predictions)
  → matches                       ← processedMatches + baked-in resolved knockout teams
```

**Why this order?** Each step depends on the previous:
- Standings need match results (scores) → must come after `processedMatches`
- 3rd-place qualifying needs all group standings → must come after `actualGroupStandings`
- Knockout resolution needs standings + 3rd-place → must come after both
- Baking needs resolved knockout teams → must come last

### 1.3 PredictionsContext — Predicted Matches (`app/src/contexts/PredictionsContext.tsx`)

```
rawProcessedMatches (from MatchContext, pre-bake)
  + actualGroupStandings (from MatchContext — for R32 team resolution)
  + actualThirdPlaceQualifying (from MatchContext — for R32 team resolution)
  + user's predictions (from PredictionsContext cache)
  → calculateAllGroupStandings(rawProcessedMatches, predictions)
  → predictedGroupStandings          ← group standings from user's predicted scores
  → getQualifyingThirdPlaceTeams(predictedGroupStandings)
  → predictedThirdPlaceQualifying    ← which 3rd-place teams qualify per predictions
  → BracketResolver(rawProcessedMatches, predictions,
                     actualGroupStandings, actualThirdPlaceQualifying,
                     useKnockoutPredictions: true)
  → resolvedKnockoutTeams (internal, not exposed)
  → predicted matches             ← context matches + baked-in predicted knockout teams
```

**R32 matchups come from actual FIFA data** (API teams → actual group standings → placeholders
if groups haven't finished). This ensures the R32 shows real opponents.

**R32 winners and all later rounds come from predictions.** The user's predicted
scores determine who advances — actual match results are ignored. This shows
the user's predicted bracket path through the tournament.

### What "baking" does

For every knockout match, replaces `match.homeTeam` / `match.awayTeam` with the resolved team (if available) and computes `homeDisplayName` / `awayDisplayName`. Consumers see correct teams transparently.

**Two kinds of baking:**
- **MatchContext** bakes **actual** resolved teams (from real match results)
- **`usePredictedMatches(userId)`** bakes **predicted** resolved teams (from a user's predictions)

### Context values exposed (MatchContext)

| Value | Type | Description |
|-------|------|-------------|
| `matches` | `MatchWithLiveInfo[]` | Enhanced matches with **actual** knockout teams baked in |
| `rawProcessedMatches` | `Match[]` | Pre-bake matches (needed by `usePredictedMatches`) |
| `resolvedKnockoutTeams` | `Map<FifaMatchId, ResolvedTeams>` | Actual-result knockout resolution |
| `actualGroupStandings` | `Map<string, CalculatedStanding[]>` | Standings computed from actual results |
| `actualThirdPlaceQualifying` | `Map<string, boolean>` | Which 3rd-place teams qualify |

### Hooks

| Hook | Location | Returns | Used for |
|------|----------|---------|----------|
| `useMatches()` | MatchContext | Full context object | General match listing, actual teams |
| `useMatch(fifaId)` | MatchContext | Single match (baked) | Match detail page |
| `usePredictedMatches(userId)` | PredictionsContext | `{ matches, predictedGroupStandings, predictedThirdPlaceQualifying }` | Profile page, predictions page |
| `usePredictedMatch(userId, fifaId)` | PredictionsContext | Single match with predicted teams | (Available for future use) |

> **Critical**: `usePredictedMatches` uses `rawProcessedMatches` (pre-bake), not `matches` (post-bake), when running BracketResolver. If `matches` were used, `BracketResolver.isValidApiTeam()` would see baked-in actual teams as "real API teams" and skip prediction-based resolution. R32 matchups use actual group standings (real opponents). R32 winners and all subsequent rounds use predictions exclusively.

---

## 2. Team Resolution Function

**File:** `app/src/lib/team-display.ts`

### `getTeamDisplaySimple(team, matchId, position, fifaNumber?)` — Single unified function

Used by: **all** match display components (`KnockoutMatchRow`, `MatchCard`, `PredictionInput`, match detail page, etc.)

Priority:
1. **Real team** with valid ID → use TLA (with overrides for special names)
2. **Placeholder team** (id in placeholder range) → use TLA as-is (EU1, IC1, etc.)
3. **Team without ID** → use tla/shortName/name
4. **Bracket label** from FIFA number (1A, W73, L101, etc.)
5. **Fallback**: "QUA" for group stage, bracket label for knockout

This works because matches always have their teams baked in — by MatchContext for actual teams, or by `usePredictedMatches` for predicted teams. No separate `resolvedTeams` prop is needed.

### `getBracketLabel(fifaNumber, position)` — Bracket position string

Returns labels like "1A" (1st in group A), "2B", "3rd", "W73" (winner of match 73), "L101" (loser of match 101).

---

## 3. BracketResolver

**File:** `app/src/lib/bracket-resolver.ts`

Resolves knockout bracket teams stage by stage: R32 → R16 → QF → SF → 3rd Place → Final.

### Per-match resolution priority:
1. **API team** — `isValidApiTeam()`: non-null, id > 0, not placeholder, valid TLA
2. **Calculated team** — from group standings (R32) or winner/loser of feeder match (R16+)
3. **Predicted team** — when `useKnockoutPredictions: true`, predictions are **always** used for winner/loser determination (even if match is finished). This ensures the bracket shows the user's predicted path, not actual results.
4. **null** → UI falls back to bracket labels

### Two invocation modes:

| Mode | `useKnockoutPredictions` | Where used | What it does |
|------|--------------------------|------------|---------------|
| Actual only | `false` (default) | MatchContext (context-level resolution) | Uses actual group standings + actual match results. Unplayed matches return null (TBD). |
| Prediction | `true` | `usePredictedMatches(userId)` in PredictionsContext | R32 matchups from actual data (real opponents). R32 winners and all later rounds from user's predicted scores. Actual match results are ignored for winner determination. |

---

## 4. Display Locations

### 4.1 Home Page — Today's Matches

**Component:** `MatchCard` (`src/components/MatchCard.tsx`)
**Rendered by:** `TodaysMatches` on the home page (`src/app/page.tsx`)

| Aspect | How it works |
|--------|-------------|
| **Teams** | Uses `matches` from context (baked). Teams are already resolved — displays via `getTeamDisplaySimple(match.homeTeam, ...)`. |
| **Score** | Actual result: `match.score.fullTime.home / .away` |
| **Predictions** | None shown |
| **Whose data** | Actual match results only |

### 4.2 Fixtures Page

**Components:** `GroupStageSection` (readOnly) + `KnockoutStageSection` (mode="fixtures")
**File:** `src/app/fixtures/page.tsx`

#### Group stage
| Aspect | How it works |
|--------|-------------|
| **Teams** | `match.homeTeam` / `match.awayTeam` from context (group stage, no baking needed) |
| **Score** | Actual results shown in disabled `PredictionInput` — synthesized as `prediction = { home_goals: match.score.fullTime.home, ... }` |
| **Predictions** | None — shows actual results in prediction-style inputs |

#### Knockout stage
| Aspect | How it works |
|--------|-------------|
| **Teams** | Uses `matches` from context (baked with actual teams). `KnockoutStageSection` receives knockout matches directly. Displayed via `getTeamDisplaySimple()`. |
| **Score** | Actual results: `scores={{ home: match.score.fullTime.home, away: match.score.fullTime.away }}` |
| **Predictions** | None |

### 4.3 Predictions Page (Current User Editing)

**Components:** `GroupStageSection` + `KnockoutStageSection` (mode="edit")
**File:** `src/app/predictions/page.tsx`

#### Group stage
| Aspect | How it works |
|--------|-------------|
| **Teams** | `match.homeTeam` / `match.awayTeam` (direct, group stage) |
| **Score** | User's prediction: editable inputs bound to `prediction.home_goals` / `.away_goals` |
| **Whose data** | Current logged-in user's predictions |

#### Knockout stage
| Aspect | How it works |
|--------|-------------|
| **Teams** | `usePredictedMatches(userId)` → returns `matches` with predicted teams baked in. Knockout matches passed to `KnockoutStageSection`. R32 teams from **actual** group standings (real opponents). R16+ teams from user's **predicted winners**, chained forward. Displayed via `getTeamDisplaySimple()`. |
| **Score** | User's prediction: editable inputs |
| **Winner select** | Shown for ties — user picks penalty winner |
| **Whose data** | Current logged-in user's predictions |

### 4.4 User Profile Page (Viewing Someone's Predictions)

**Components:** `UserGroupSection` + `KnockoutStageSection` (mode="predictions")
**File:** `src/app/user/[userId]/page.tsx`

#### Group stage — `UserGroupSection` → `GroupMatchRow`
| Aspect | How it works |
|--------|-------------|
| **Teams** | `getTeamDisplaySimple(match.homeTeam, ...)` — direct from baked `matches` |
| **Score** | Viewed user's prediction: `prediction?.home_goals ?? match.score.fullTime.home` |
| **Points** | `MatchPointsTooltip` with breakdown for finished matches |
| **Whose data** | The viewed user (userId) |

#### Knockout stage — `KnockoutStageSection` → `KnockoutMatchRow` (shared)
| Aspect | How it works |
|--------|-------------|
| **Teams** | `usePredictedMatches(userId)` → returns `matches` with viewed user's predicted teams baked in. Knockout matches passed to `KnockoutStageSection`. Shows teams as the viewed user predicted them. Displayed via `getTeamDisplaySimple()`. |
| **Score** | Viewed user's prediction: `prediction?.home_goals / .away_goals` |
| **Points** | `MatchPointsTooltip` passed as `pointsTooltip` prop |
| **Whose data** | The viewed user (userId) |

### 4.5 Match Detail Page

**File:** `src/app/match/[matchId]/page.tsx`

#### Match header
| Aspect | How it works |
|--------|-------------|
| **Teams** | `useMatch(fifaId)` → single match from `matches` (baked). Displayed via `getTeamDisplaySimple(match.homeTeam, ...)` |
| **Score** | Actual result: `match.score.fullTime.home / .away` |

#### All users' predictions panel
| Aspect | How it works |
|--------|-------------|
| **Teams** | Not re-resolved — displays score numbers only against the match header teams |
| **Score** | Each user's `pred.homeGoals` / `pred.awayGoals` from `useAllPredictions()` |
| **Points** | From `useMatchPointsForAllUsers()` (centralized LeaderboardContext calculation) |
| **Whose data** | All users who predicted this match |

### 4.6 MatchPointsTooltip

**File:** `src/components/MatchPointsTooltip.tsx`

| Aspect | How it works |
|--------|-------------|
| **Teams** | Uses `match.homeTeam` / `match.awayTeam` (baked) for team TLAs in labels |
| **Predicted teams** | Receives `predictedHomeTeam` / `predictedAwayTeam` props for knockout team matching in score calculation |
| **Score** | Shows actual score (`match.score.fullTime`) vs prediction |
| **Points** | Calls `calculateMatchPoints()` or uses `matchBreakdown` prop. Shows all scoring categories with 0 for unearned |
| **When shown** | Only for finished/live matches with a prediction |

---

## 5. Component → Team Resolution Summary

| Display Location | Component Chain | Team Resolution Method | Matches Source |
|------------------|----------------|----------------------|----------------|
| Home / Today's Matches | `MatchCard` | `getTeamDisplaySimple(match.homeTeam)` | `matches` (baked, actual) |
| Fixtures / Group | `GroupStageSection` → `PredictionInput` | `match.homeTeam` direct | `matches` (baked, actual) |
| Fixtures / Knockout | `KnockoutStageSection` → `KnockoutMatchRow` | `getTeamDisplaySimple(match.homeTeam)` | `matches` (baked, actual) |
| Predictions / Group | `GroupStageSection` → `PredictionInput` | `match.homeTeam` direct | `matches` (baked, actual) |
| Predictions / Knockout | `KnockoutStageSection` → `KnockoutMatchRow` | `getTeamDisplaySimple(match.homeTeam)` | `usePredictedMatches(userId).matches` (baked, predicted) |
| Profile / Group | `UserGroupSection` → `GroupMatchRow` | `getTeamDisplaySimple(match.homeTeam)` | `matches` (baked, actual) |
| Profile / Knockout | `KnockoutStageSection` → `KnockoutMatchRow` | `getTeamDisplaySimple(match.homeTeam)` | `usePredictedMatches(userId).matches` (baked, predicted) |
| Match Detail Header | inline | `getTeamDisplaySimple(match.homeTeam)` | `matches` (baked, actual) via `useMatch()` |
| Match Detail Predictions | inline | Scores only, no team re-resolution | N/A |
| Tooltip | `MatchPointsTooltip` | `match.homeTeam` (baked) for labels; `predictedHomeTeam` prop for scoring calc | `matches` (baked) |

---

## 6. Score Display Summary

| Display Location | What's Shown | Source |
|------------------|-------------|--------|
| Home / Today's Matches | Actual result | `match.score.fullTime` |
| Fixtures / Group | Actual result (in disabled inputs) | `match.score.fullTime` synthesized as prediction |
| Fixtures / Knockout | Actual result | `match.score.fullTime` via `scores` prop |
| Predictions / Group | User's prediction (editable) | `prediction.home_goals / .away_goals` |
| Predictions / Knockout | User's prediction (editable) | `prediction.home_goals / .away_goals` |
| Profile / Group | Viewed user's prediction | `prediction?.home_goals` (fallback: actual score) |
| Profile / Knockout | Viewed user's prediction | `prediction?.home_goals / .away_goals` |
| Match Detail Header | Actual result | `match.score.fullTime` |
| Match Detail Predictions | Each user's prediction | `pred.homeGoals / .awayGoals` |
| Tooltip | Actual vs predicted | Both shown for comparison |
