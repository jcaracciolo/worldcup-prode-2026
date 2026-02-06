# WorldCupProde Specification

## Overview

WorldCupProde is a fantasy betting application for the FIFA World Cup. The application is designed to track user selections and scores during the tournament.

**Note:** This is not a real-money betting application. It's for tracking predictions and scores among friends/groups.

## World Cup 2026 Format

The FIFA World Cup 2026 is hosted by USA, Mexico, and Canada. It's the first World Cup with **48 teams** (expanded from 32). Teams are divided into **12 groups of 4 teams** each. In the group stage, each team plays 3 matches. The top 2 teams from each group (24 teams) plus the 8 best third-placed teams advance to the knockout stage. The knockout stage consists of Round of 32, Round of 16, Quarter-finals, Semi-finals, Third-place match, and Final. Total matches: **104 games** (48 group stage + 56 knockout).

## Core Features

- Track match selections/predictions
- Track scores
- World Cup match data integration

## Scoring System

### Phase 1: Group Stage Predictions (before tournament starts)

Users predict the score (goals) for all 48 group stage matches before the World Cup begins.

**Per match scoring:**

| Prediction | Points |
|------------|--------|
| Correct result (win/draw/loss) | 2 |
| Exact goals for Team A | 1 |
| Exact goals for Team B | 1 |
| **Max per match** | **4** |

*Example: Predict 3-1, actual 0-1 → 2 pts (correct result: away win) + 0 (wrong home goals) + 1 (correct away goals) = 3 points*

### Phase 2: Group Standings Bonus (after group stage)

Points awarded based on how group predictions (derived from match predictions) align with final standings.

**Per team scoring:**

| Prediction | Points |
|------------|--------|
| Team survives (advances from group) | 1 |
| Correct position in group | 1 |
| **Max per group (3 advancing teams)** | **6** |

*Note: Up to 3 teams per group can advance (1st, 2nd, and potentially 3rd as best third-place).*

### Phase 3: Knockout Stage Predictions (after group stage ends)

Users get a second chance to predict all knockout matches once group stage is complete.

**Per match scoring:**

| Prediction | Points |
|------------|--------|
| Correct team wins | 1 × multiplier |
| Correct team loses | 1 × multiplier |
| Exact goals for Team A | 1 |
| Exact goals for Team B | 1 |

*Note: You can only score points for teams you predicted to reach that stage.*

**Round multipliers:**

| Round | Result Multiplier | Max Points (result + goals) |
|-------|-------------------|------------------------------|
| Round of 32 | 1× | 4 (2+2) |
| Round of 16 | 1× | 4 (2+2) |
| Quarter-finals | 1× | 4 (2+2) |
| Semi-finals | 2× | 6 (4+2) |
| Third-place match | 3× | 8 (6+2) |
| Final | 4× | 10 (8+2) |

## API

**Provider:** [Football-Data.org](https://www.football-data.org/)  
**Base URL:** `https://api.football-data.org/v4/`  
**Authentication:** API key in `X-Auth-Token` header  
**Token Storage:** `.secrets` file (git-ignored)  
**Free Tier:** 10 requests/minute

### World Cup 2026 Data

- **Competition Code:** `WC`
- **Competition ID:** `2000`
- **Tournament Dates:** June 11 - July 19, 2026
- **Season ID:** `2398`

### Key Endpoints

| Endpoint                         | Description                |
| -------------------------------- | -------------------------- |
| `GET /competitions/WC`           | World Cup competition info |
| `GET /competitions/WC/matches`   | All matches/fixtures       |
| `GET /competitions/WC/teams`     | Participating teams        |
| `GET /competitions/WC/standings` | Group standings            |

### Example Request

```bash
curl -H "X-Auth-Token: YOUR_TOKEN" https://api.football-data.org/v4/competitions/WC/matches
```
