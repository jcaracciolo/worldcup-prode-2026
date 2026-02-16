# Match Display Logic

How teams and scores are resolved and shown across every match-display surface in the app.

---

## 1. Data Pipeline (MatchContext)

**File:** `app/src/contexts/MatchContext.tsx`

All match data flows through a single pipeline:

```
rawMatches (from API)
  → applySimulation()
  → processedMatches          ← "raw" knockout teams (placeholders or API originals)
  → actualGroupStandings      ← computed from processedMatches
  → actualThirdPlaceQualifying
  → resolvedKnockoutTeams     ← BracketResolver(processedMatches, NO predictions)
  → matches                   ← processedMatches + baked-in resolved knockout teams
```

### What "baking" does

For every knockout match, the `matches` array replaces `match.homeTeam` / `match.awayTeam` with the resolved team from `resolvedKnockoutTeams` (if available). This means any consumer reading `matches` from context sees the actual resolved teams transparently — no need to cross-reference `resolvedKnockoutTeams` separately.

### Context values exposed

| Value | Type | Description |
|-------|------|-------------|
| `matches` | `Match[]` | Enhanced matches with **baked-in** knockout teams |
| `rawProcessedMatches` | `Match[]` | Pre-bake matches (original API teams/placeholders) |
| `resolvedKnockoutTeams` | `Map<FifaMatchId, ResolvedTeams>` | Actual-result knockout resolution |
| `actualGroupStandings` | `Map<string, CalculatedStanding[]>` | Standings computed from actual results |
| `actualThirdPlaceQualifying` | `Map<string, boolean>` | Which 3rd-place teams qualify |

### Context hooks

| Hook | Returns | Used for |
|------|---------|----------|
| `useMatches()` | Full context object | General match listing |
| `useMatch(fifaId)` | Single match from `matches` (baked) | Match detail page |
| `useKnockoutTeams(predictions?)` | `Map<FifaMatchId, ResolvedTeams>` | Team resolution for knockout display |

### useKnockoutTeams behavior

- **Without predictions**: Returns `resolvedKnockoutTeams` from context (actual results only).
- **With predictions**: Runs a **new** `BracketResolver` on `rawProcessedMatches` (NOT `matches`) with `useKnockoutPredictions: true`. This resolves R16+ teams based on the user's predicted winners, chaining forward through the bracket.

> **Critical**: Must use `rawProcessedMatches` (pre-bake), not `matches` (post-bake). If `matches` were used, `BracketResolver.isValidApiTeam()` would see the baked-in actual teams as "real API teams" and skip prediction-based resolution — causing R16+ to show actual teams (e.g. "GER") instead of the user's predicted teams, or bracket labels like "W99" when the actual team was baked but doesn't match what the user predicted.

---

## 2. Team Resolution Functions

**File:** `app/src/lib/team-display.ts`

### `getTeamDisplay(context)` — Full resolution

Used by: `KnockoutMatchRow` (shared, in `MatchRowShared.tsx`)

Priority:
1. **Real API team** from `match.homeTeam`/`match.awayTeam` (valid id, non-placeholder)
2. **Resolved team** from `resolvedTeams` (passed as prop from `useKnockoutTeams`)
3. **Resolved display name** from `resolvedTeams`
4. **Bracket label** computed from FIFA number (e.g. "1A", "W73")
5. **Fallback**: "TBD"

### `getTeamDisplaySimple(team, matchId, position, fifaNumber?)` — Simple resolution

Used by: `MatchCard`, `UserKnockoutSection`, `PredictionInput`, match detail page

Priority:
1. **Real team** with valid ID → use TLA
2. **Placeholder team** (id in placeholder range) → use TLA as-is
3. **Team without ID** → use tla/shortName/name
4. **Bracket label** from FIFA number
5. **Fallback**: "TBD"

### `getBracketLabel(fifaNumber, position)` — Bracket position string

Returns labels like "1A" (1st in group A), "2B", "3rd", "W73" (winner of match 73), "L101" (loser of match 101).

---

## 3. BracketResolver

**File:** `app/src/lib/bracket-resolver.ts`

Resolves knockout bracket teams stage by stage: R32 → R16 → QF → SF → 3rd Place → Final.

### Per-match resolution priority:
1. **API team** — `isValidApiTeam()`: non-null, id > 0, not placeholder, valid TLA
2. **Calculated team** — from group standings (R32) or winner/loser of feeder match (R16+)
3. **Predicted team** — only when `useKnockoutPredictions: true` and match isn't finished
4. **null** → UI falls back to bracket labels

### Two invocation modes:

| Mode | `useKnockoutPredictions` | Where used | Effect on R16+ |
|------|--------------------------|------------|-----------------|
| Actual only | `false` (default) | MatchContext (context-level resolution) | R16+ returns null for unplayed matches |
| With predictions | `true` | `useKnockoutTeams(predictions)` | R16+ chains predicted winners forward |

---

## 4. Display Locations

### 4.1 Home Page — Today's Matches

**Component:** `MatchCard` (`src/components/MatchCard.tsx`)  
**Rendered by:** `TodaysMatches` on the home page (`src/app/page.tsx`)

| Aspect | How it works |
|--------|-------------|
| **Teams** | Uses `matches` from context (baked). Additionally overlays `resolvedKnockoutTeams` for knockout matches: `resolved?.home ?? match.homeTeam`. Displays via `getTeamDisplaySimple()`. |
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
| **Teams** | `useKnockoutTeams()` called with **no predictions** → returns `resolvedKnockoutTeams` from context (actual). Passed to `KnockoutMatchRow` as `resolvedTeams` prop. Displayed via `getTeamDisplay()`. |
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
| **Teams** | `useKnockoutTeams(predictions)` → runs BracketResolver on `rawProcessedMatches` with `useKnockoutPredictions: true`. R32 teams from actual group standings. R16+ teams from user's **predicted winners**, chained forward. |
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
| **Teams** | `useKnockoutTeams(predictions)` called with the **viewed user's predictions**. Runs BracketResolver on `rawProcessedMatches` with `useKnockoutPredictions: true`. Shows teams as the viewed user predicted them. |
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

## 5. UserKnockoutSection (Currently Unused)

**File:** `src/components/UserKnockoutSection.tsx`

> **Note:** This component is defined but **not imported or used anywhere** in the app. The profile page uses `KnockoutStageSection` instead. This component is dead code.

It has its own local `KnockoutMatchRow` and its own `BracketResolver` instance. If it were used, it would receive raw `matches` as a prop (not from context), run BracketResolver **without** `useKnockoutPredictions: true`, meaning only R32 teams would resolve from standings — R16+ would show null/bracket labels.

---

## 6. Component → Team Resolution Summary

| Display Location | Component Chain | Team Resolution Method | Matches Source |
|------------------|----------------|----------------------|----------------|
| Home / Today's Matches | `MatchCard` | `resolvedKnockoutTeams` overlay + `getTeamDisplaySimple()` | `matches` (baked) |
| Fixtures / Group | `GroupStageSection` → `PredictionInput` | `match.homeTeam` direct | `matches` (baked) |
| Fixtures / Knockout | `KnockoutStageSection` → `KnockoutMatchRow` | `useKnockoutTeams()` (no predictions) → `getTeamDisplay()` | `resolvedKnockoutTeams` from context |
| Predictions / Group | `GroupStageSection` → `PredictionInput` | `match.homeTeam` direct | `matches` (baked) |
| Predictions / Knockout | `KnockoutStageSection` → `KnockoutMatchRow` | `useKnockoutTeams(predictions)` → `getTeamDisplay()` | `rawProcessedMatches` via BracketResolver |
| Profile / Group | `UserGroupSection` → `GroupMatchRow` | `getTeamDisplaySimple(match.homeTeam)` | `matches` (baked) |
| Profile / Knockout | `KnockoutStageSection` → `KnockoutMatchRow` | `useKnockoutTeams(predictions)` → `getTeamDisplay()` | `rawProcessedMatches` via BracketResolver |
| Match Detail Header | inline | `getTeamDisplaySimple(match.homeTeam)` | `matches` (baked) via `useMatch()` |
| Match Detail Predictions | inline | Scores only, no team re-resolution | N/A |
| Tooltip | `MatchPointsTooltip` | `match.homeTeam` (baked) for labels; `predictedHomeTeam` prop for scoring calc | `matches` (baked) |

---

## 7. Score Display Summary

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
