# Scoring Calculation — How It Works & Known Issues

## Overview

Scoring involves three layers:

1. **Scoring rules** — what points are awarded for what
2. **Team resolution** — determining which teams the user predicted for each knockout slot
3. **Display** — showing the breakdown in tooltips

---

## 1. Scoring Rules (from spec)

### Group Stage (72 matches)

| Category                       | Points | Condition                       |
| ------------------------------ | ------ | ------------------------------- |
| Correct result (win/draw/loss) | 2      | Predicted result matches actual |
| Exact goals for home team      | 1      | Predicted home goals = actual   |
| Exact goals for away team      | 1      | Predicted away goals = actual   |
| **Max per match**              | **4**  |                                 |

**Position-based**: home team is always home, away is always away. Simple comparison.

### Group Standings Bonus (after group stage completes)

| Category                 | Points | Condition                                                                                |
| ------------------------ | ------ | ---------------------------------------------------------------------------------------- |
| Team advances from group | 1      | User predicted team in top 2 (or 3rd if predicted to qualify) AND team actually advanced |
| Correct position         | 1      | Team finished in the exact position user predicted                                       |
| **Max per group**        | **6**  | 3 advancing teams × 2 points each                                                        |

### Knockout — Round of 32 (16 matches)

Same structure as group stage but with 2 pts per goal instead of 1:

| Category                       | Points | Condition                                        |
| ------------------------------ | ------ | ------------------------------------------------ |
| Correct result (win/draw/loss) | 2      | Predicted result matches actual (position-based) |
| Exact goals for home team      | 2      | Predicted home goals = actual                    |
| Exact goals for away team      | 2      | Predicted away goals = actual                    |
| **Max per match**              | **6**  |                                                  |

**Position-based**: Like group stage, home/away slots are fixed. If user predicted "home wins 2-1", we check if the home team actually won and if home scored 2, away scored 1. No team identity check needed because R32 teams are determined by group standings and their slots are fixed.

### Knockout — R16 through Final (16 matches)

**Team-based** — points are awarded per-team, not per-position:

| Category                          | Points         | Condition                                                                        |
| --------------------------------- | -------------- | -------------------------------------------------------------------------------- |
| Predicted winner correct          | 1 × multiplier | The team user predicted to win actually won                                      |
| Predicted loser correct           | 1 × multiplier | The team user predicted to lose actually lost                                    |
| Predicted tie correct (each team) | 1 × multiplier | If actual result is a tie, 1 pt per team that user predicted to be in this match |
| Exact goals (actual home team)    | 2              | User's predicted goals for this team = actual goals                              |
| Exact goals (actual away team)    | 2              | User's predicted goals for this team = actual goals                              |
| **Max per match**                 | **2×mult + 4** |                                                                                  |

**Round multipliers:**

| Round     | Multiplier | Max Points |
| --------- | ---------- | ---------- |
| R32       | 1×         | 6          |
| R16       | 2×         | 8          |
| QF        | 3×         | 10         |
| SF        | 4×         | 12         |
| 3rd Place | 5×         | 14         |
| Final     | 6×         | 16         |

---

## 2. Team Resolution — The Hard Part

The key question for R16+ scoring: **"Which teams did the user predict for each knockout match slot?"**

### Why this matters

A user's group predictions determine which teams they think qualify. Their knockout predictions determine who they think wins each match. Together, this builds a **predicted bracket** — a chain of teams flowing through each round.

For scoring, we compare:

- **User's predicted winner** (a specific team, e.g., "Brazil") vs **actual winner** (the team that actually won)
- **User's predicted loser** (e.g., "Haiti") vs **actual loser** (the team that actually lost)

This is different from R32 where we just check "did home win?" — in R16+, the user might have predicted different teams entirely for that slot.

### How team resolution works: BracketResolver

`BracketResolver` is the class that determines which teams appear in each knockout match slot.

It takes these inputs:

- `matches` — all 104 match objects
- `groupStandings` — a Map of group standings (either actual or user-predicted)
- `predictions` — user's score predictions for each match
- `thirdPlaceQualifying` — which 3rd-place teams qualify
- `useKnockoutPredictions` — whether to chain predicted winners (true) or actual winners (false)
- `alwaysResolveFromStandings` — whether to skip API team data and always derive teams from standings

Resolution chain:

1. **R32**: Teams come from group standings (1st place Group A vs best 3rd, etc.)
2. **R16**: Each slot gets the winner of two R32 matches
3. **QF**: Winners of R16 matches
4. **SF**: Winners of QF matches
5. **Third Place**: Losers of SF matches
6. **Final**: Winners of SF matches

At each step, if `isValidApiTeam` returns true AND `alwaysResolveFromStandings` is false, the API team is used directly. Otherwise, teams are computed from the bracket chain.

### Two paths that use BracketResolver

|                                | Display Path                                        | Scoring Path                                         |
| ------------------------------ | --------------------------------------------------- | ---------------------------------------------------- |
| **Purpose**                    | Show user's predicted bracket on profile page       | Calculate points earned                              |
| **Group standings**            | Actual (from API)                                   | User-predicted (from user's group match predictions) |
| **useKnockoutPredictions**     | true                                                | true                                                 |
| **alwaysResolveFromStandings** | false                                               | **true**                                             |
| **API teams used?**            | Yes (shows actual matchups)                         | No (always uses user's predicted standings)          |
| **Result**                     | Actual teams with user's predicted winners overlaid | User's fully predicted bracket                       |

**Why they differ**: The display path shows "given the _actual_ matchups, who does the user think will win?" The scoring path computes "based on the user's _predicted_ group results, who did they think would be in each slot?" — this is the user's full predicted bracket, which is what gets compared against reality for points.

---

## 3. Current Scoring Logic in Code

### `calculateGroupStagePoints(match, prediction)`

- Pure position-based comparison
- 2 pts for correct result, 1 pt each for exact home/away goals
- Returns `PointBreakdown[]` with type `"result"`, `"goals_home"`, `"goals_away"`

### `calculateKnockoutPoints(match, prediction, predictedTeams)`

- `predictedTeams` = the teams BracketResolver resolved for this match slot
- Two modes based on stage:

**R32 (position-based):**

- `predictedResult === actualResult` → 2 pts (type `"result"`)
- `prediction.home_goals === actualHomeGoals` → 2 pts (type `"goals_home"`)
- `prediction.away_goals === actualAwayGoals` → 2 pts (type `"goals_away"`)

**R16+ (team-based):**

- Builds `predictedWinnerTeam` / `predictedLoserTeam` from `predictedTeams` + user's predicted result
- Compares `predictedWinnerTeam.id === actualWinner.id` → 1 × multiplier (type `"knockout_win"`)
- Compares `predictedLoserTeam.id === actualLoser.id` → 1 × multiplier (type `"knockout_lose"`)
- For ties: checks if `predictedTeamIds.has(actualTeam.id)` → 1 × multiplier each (type `"knockout_tie"`)
- Goals: maps user's predicted goals to actual teams by team ID (handles swapped home/away slots)
- Fallback: if `predictedTeams` is undefined, falls back to position-based (like R32)

### `calculateGroupStandingsBonusPoints(...)`

- Only runs after all group matches are finished
- 1 pt for predicting a team to advance that actually advanced
- 1 additional pt if the exact position matches

### `calculateTotalPoints(matches, predictions, ...)`

- Entry point that orchestrates everything
- Computes user's predicted group standings from their match predictions
- Runs BracketResolver with `alwaysResolveFromStandings: true` to get user's predicted bracket
- Calls `calculateGroupStagePoints` for group matches
- Calls `calculateKnockoutPoints` with resolved predicted teams for knockout matches
- Calls `calculateGroupStandingsBonusPoints` for each group

---

## 4. Tooltip Display (`MatchPointsTooltip`)

The tooltip receives `matchId` + `userId`, and:

1. Gets actual match data from `useMatch(matchId)` (MatchContext)
2. Gets user's pre-computed breakdown from `useLeaderboard().getUserScore(userId).breakdown`
3. Filters breakdown to this match
4. Renders rows using actual team names (from match) + earned points (from breakdown)

For knockout: labels show actual winner/loser team names. Points come directly from the pre-computed breakdown — no re-calculation.

---

## 5. Known Issues & Complexity

### Issue: Two different team universes

The **display path** shows actual teams (EU1 vs NED as assigned by API), while the **scoring path** uses the user's predicted teams (EU1 vs HAI from their predicted group standings). These can diverge, creating confusion:

- Tooltip shows "EU1 win (2×): +2" and "NED lose (2×): 0"
- But the user predicted EU1 vs HAI, not EU1 vs NED
- The scoring correctly awarded +2 for EU1 win (user predicted EU1 to win, EU1 did win)
- The scoring correctly gave 0 for NED lose (user predicted HAI to lose, not NED)
- But the tooltip labels use actual teams (EU1, NED) while the scoring compared against predicted teams (EU1, HAI)

This is **technically correct** but **confusing to the user** because the win/lose labels don't match what they predicted.

### Issue: `calculateMatchPoints` is stale

The `calculateMatchPoints` function (line ~126) is an older single-match scoring function that still uses position-based logic for knockout. It's NOT used by the tooltip anymore (which reads from the leaderboard breakdown), but it may still be called elsewhere. It should either be updated to match the team-based logic or removed if unused.

### Issue: R32 special-casing

R32 uses position-based scoring while R16+ uses team-based. The spec says R32 should work "like group stage" with a single correct-result check. This is because R32 teams are determined directly from group standings — the user's predicted group standings already determine the R32 matchups, so there's no additional "which team did you predict" question. The teams in the slot ARE the predicted teams.

### Simplification opportunity

The R16+ scoring could be simplified if we acknowledge that `alwaysResolveFromStandings` already ensures the scoring BracketResolver uses the user's predicted standings. The `predictedTeams` it produces ARE the user's predicted matchups. So the team-identity comparison could in theory just be: "does the user's predicted result for this match (home/away/draw) match the actual result, given that the teams might be in different slots?"

The current implementation handles the case where a user predicts Team A in the home slot but Team A is actually the away team — it still gives credit for predicting Team A's goals correctly regardless of slot position. This is correct behavior per the spec rule "you can only score points for teams you predicted to reach that stage."
