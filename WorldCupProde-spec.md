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

| Prediction                     | Points |
| ------------------------------ | ------ |
| Correct result (win/draw/loss) | 2      |
| Exact goals for Team A         | 1      |
| Exact goals for Team B         | 1      |
| **Max per match**              | **4**  |

_Example: Predict 3-1, actual 0-1 → 2 pts (correct result: away win) + 0 (wrong home goals) + 1 (correct away goals) = 3 points_

### Phase 2: Group Standings Bonus (after group stage)

Points awarded based on how group predictions (derived from match predictions) align with final standings.

**Per team scoring:**

| Prediction                            | Points |
| ------------------------------------- | ------ |
| Team survives (advances from group)   | 1      |
| Correct position in group             | 1      |
| **Max per group (3 advancing teams)** | **6**  |

_Note: Up to 3 teams per group can advance (1st, 2nd, and potentially 3rd as best third-place)._

### Phase 3: Knockout Stage Predictions (after group stage ends)

Users get a second chance to predict all knockout matches once group stage is complete.

**Per match scoring:**

| Prediction                           | Points         |
| ------------------------------------ | -------------- |
| Correct team wins                    | 1 × multiplier |
| Correct team loses                   | 1 × multiplier |
| Correct team ties (before penalties) | 1 × multiplier |
| Exact goals for Team A               | 1              |
| Exact goals for Team B               | 1              |

_Note: For R32 through Semi-finals, predicting a tie is enough (the advancing team is implied). For Third-place match and Final, you must also pick the winner since both teams' tournament ends there._

_Note: You can only score points for teams you predicted to reach that stage._

**Round multipliers:**

| Round             | Result Multiplier | Max Points (result + goals) |
| ----------------- | ----------------- | --------------------------- |
| Round of 32       | 1×                | 4 (2+2)                     |
| Round of 16       | 1×                | 4 (2+2)                     |
| Quarter-finals    | 1×                | 4 (2+2)                     |
| Semi-finals       | 2×                | 6 (4+2)                     |
| Third-place match | 3×                | 8 (6+2)                     |
| Final             | 4×                | 10 (8+2)                    |

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

## Technical Architecture

### Stack

| Layer           | Technology                      |
| --------------- | ------------------------------- |
| Frontend        | Next.js (React) with TypeScript |
| Auth & Database | Supabase (PostgreSQL + Auth)    |
| Hosting         | Azure App Service               |
| Match Data      | Football-Data.org API           |

### Authentication Flow

1. Admin generates an **invite code** in the admin panel
2. User visits signup page with invite code (e.g., `/signup?code=ABC123`)
3. User creates account via Supabase Auth (email/password or OAuth)
4. Invite code is marked as used, user is activated immediately (no email verification)

**Supabase Config:** Disable "Confirm email" in Authentication → Settings → Email Auth

### Access Control

| Role               | Can View                                     | Can Predict         | Can Admin                           |
| ------------------ | -------------------------------------------- | ------------------- | ----------------------------------- |
| Guest (no account) | Standings, all guesses, matches, live scores | No                  | No                                  |
| User (invited)     | Everything                                   | Yes (before cutoff) | No                                  |
| Admin              | Everything                                   | Yes                 | Generate invite codes, manage users |

### Database Schema (Supabase PostgreSQL)

```
users (managed by Supabase Auth)
├── id (uuid)
├── email
├── display_name
└── is_admin (boolean)

invite_codes
├── id (uuid)
├── code (string, unique)
├── created_by (uuid -> users)
├── used_by (uuid -> users, nullable)
├── created_at
└── used_at (nullable)

predictions
├── id (uuid)
├── user_id (uuid -> users)
├── match_id (int, from Football-Data API)
├── home_goals (int)
├── away_goals (int)
├── winner_id (int, nullable, for Final/3rd place ties)
├── created_at
└── updated_at

matches_cache
├── match_id (int, primary key)
├── data (jsonb, full API response)
├── updated_at

tournament_settings
├── id (int, always 1)
├── group_stage_locked (boolean, default false)
├── knockout_stage_open (boolean, default false)
├── knockout_stage_locked (boolean, default false)
├── updated_at
```

### Prediction Windows

| Phase          | Opens                           | Locks                       | Predictions Visible         |
| -------------- | ------------------------------- | --------------------------- | --------------------------- |
| Group Stage    | Immediately                     | Before first group match    | After group stage starts    |
| Knockout Stage | When knockout teams are defined | Before first knockout match | After knockout stage starts |

**Privacy:** Users can only see their own predictions until that stage begins. Once a stage starts, all predictions for that stage become public.

### Key Features

**Public (no login required):**

- View all matches (today's matches highlighted, local timezone)
- View live/final scores (cached from API)
- View leaderboard/standings
- View all users' predictions (only after respective stage starts)

**Authenticated users:**

- Create/edit group stage predictions (until group stage locks)
- Create/edit knockout predictions (when open, until knockout stage locks)
- View own predictions anytime

**Admin:**

- Generate invite codes
- View invite code usage
- **Lock Group Stage** - manually start group stage (locks predictions, makes them public)
- **Open Knockout Stage** - enable knockout predictions (after teams are defined)
- **Lock Knockout Stage** - start knockout stage (locks predictions, makes them public)
- **Generate Random Results** (testing) - auto-fill match results for testing scoring
- **Reset Tournament State** (testing) - reset locks for re-testing

### Match Data Sync

- **Server cron job** runs every 1 minute during matches to fetch scores from Football-Data.org API
- Results cached in `matches_cache` table (server is the single source fetching from API)
- **Clients poll our server** (not the API) for updates — reduces API usage to ~1 req/min regardless of user count

### Deployment (Azure App Service)

```
┌─────────────────────────────────┐
│     Azure App Service           │
│     (Next.js SSR)               │
│     - Frontend                  │
│     - API Routes                │
├─────────────────────────────────┤
│     Environment Variables       │
│     - SUPABASE_URL              │
│     - SUPABASE_ANON_KEY         │
│     - SUPABASE_SERVICE_KEY      │
│     - FOOTBALL_DATA_API_TOKEN   │
└─────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│     Supabase (hosted)           │
│     - PostgreSQL                │
│     - Auth                      │
│     - Row Level Security        │
└─────────────────────────────────┘
```

### Setup Checklist

- [ ] Create Supabase project
- [ ] Set up database schema and RLS policies
- [ ] Initialize Next.js project with TypeScript
- [ ] Configure Supabase client
- [ ] Create Azure App Service
- [ ] Set up GitHub Actions for CI/CD
- [ ] Configure environment variables in Azure
