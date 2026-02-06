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

## Views / Screens

### Header (all pages)

- Logo (links to home)
- **Logged out:** Login button
- **Logged in:** Logout button, Predictions button, Settings button
- **Admin:** Additional Admin button

---

### 1. Home Page (`/`)

**Visible to everyone (public)**

**Layout:**

```
┌─────────────────────────────────────────────────┐
│  [Logo]                    [Login] or [Logout]  │
│                            [Predictions]        │
├─────────────────────────────────────────────────┤
│           TODAY'S MATCHES / NEXT MATCHES        │
│  ┌─────────────────────────────────────────┐    │
│  │  🇦🇷 Argentina  2 - 1  Nigeria 🇳🇬       │    │
│  │     Messi 45'           Osimhen 32'     │    │
│  │     Di María 78'                        │    │
│  └─────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────┐    │
│  │  🇧🇷 Brazil  0 - 0  Germany 🇩🇪   LIVE   │    │
│  └─────────────────────────────────────────┘    │
├─────────────────────────────────────────────────┤
│              LEADERBOARD                        │
│  ┌──────────────────────────────────────────┐   │
│  │  #   Player          Points              │   │
│  │  1   Juan            142                 │   │
│  │  2   Maria           138                 │   │
│  │  3   Carlos          135                 │   │
│  │  ...                                     │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

- Shows matches for today (or next day if no matches today)
- Live scores update automatically (poll server every minute)
- Goal scorers displayed under each team
- Click on user row → goes to their predictions page
- Click on match → goes to match detail page

---

### 2. Login Page (`/login`)

- Email input
- Password input
- Login button
- Link to signup: "Don't have an account? Sign up"

---

### 3. Signup Page (`/signup?code=INVITE_CODE`)

- Invite code (pre-filled from URL, read-only)
- Display name input
- Email input
- Password input
- Signup button
- Error if invalid/used invite code

---

### 4. Settings Page (`/settings`)

**Requires login**

- Change display name
- Change password
- (Simple form, nothing fancy)

---

### 5. Predictions Page (`/predictions`)

**Requires login**

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│  [Header]                                                   │
├─────────────────────────────────────────────────────────────┤
│  GROUP STAGE PREDICTIONS                    [Save Predictions]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  GROUP A                          │  STANDINGS              │
│  ┌─────────────────────────────┐  │  ┌─────────────────┐   │
│  │ Argentina [__] - [__] Nigeria│  │  │ 1. Argentina    │   │
│  │ Brazil    [__] - [__] Mexico │  │  │ 2. Brazil  [↕]  │   │
│  │ Argentina [__] - [__] Brazil │  │  │ 3. Mexico  [↕]  │   │
│  │ Nigeria   [__] - [__] Mexico │  │  │ 4. Nigeria      │   │
│  │ Argentina [__] - [__] Mexico │  │  └─────────────────┘   │
│  │ Brazil    [__] - [__] Nigeria│  │                        │
│  └─────────────────────────────┘  │                        │
│                                                             │
│  GROUP B                          │  STANDINGS              │
│  ...                              │  ...                    │
├─────────────────────────────────────────────────────────────┤
│  KNOCKOUT STAGE PREDICTIONS                                 │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  [BLURRED / LOCKED - Opens after group stage]           ││
│  └─────────────────────────────────────────────────────────┘│
│  OR (when open):                                            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  ROUND OF 32                                            ││
│  │  Match 1: [Team] [__] - [__] [Team]  [Select winner ▼]  ││
│  │  Match 2: ...                                           ││
│  │  ...                                                    ││
│  │                                                         ││
│  │  ROUND OF 16                                            ││
│  │  ...                                                    ││
│  │                                                         ││
│  │  QUARTER-FINALS                                         ││
│  │  ...                                                    ││
│  │                                                         ││
│  │  ┌─────────────────────────────────────┐                ││
│  │  │      SEMI-FINALS → FINAL BRACKET    │                ││
│  │  │  SF1 ──┐                            │                ││
│  │  │        ├── Final                    │                ││
│  │  │  SF2 ──┘     │                      │                ││
│  │  │              └── Champion           │                ││
│  │  │  3rd Place Match                    │                ││
│  │  └─────────────────────────────────────┘                ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Features:**

- Editable goal inputs for each team
- Standings auto-calculate based on match predictions
- Tiebreaker: [↕] button to swap position when teams have same points
- Knockout: Select winner dropdown appears when predicting a tie (for all rounds)
- Knockout: Third-place and Final always require winner selection
- Save Predictions button (one save for all)
- Locked state: inputs become read-only after deadline

---

### 6. User Predictions View (`/user/:userId`)

**Public (but content may be blurred)**

Same layout as Predictions Page but:

- Read-only (no editing)
- **Before group stage starts:** Group predictions are blurred
- **Before knockout stage starts:** Knockout predictions are blurred
- **After each stage starts:** Predictions become visible
- At bottom: Detailed points breakdown table

**Points Breakdown Table:**

```
┌────────────────────────────────────────────────────────────┐
│  POINTS BREAKDOWN                              Total: 142  │
├────────────────────────────────────────────────────────────┤
│  + 2 pts  Correct result: Argentina win (ARG 2-1 NIG)     │
│  + 1 pt   Correct goals: Argentina 2 (ARG 2-1 NIG)        │
│  + 1 pt   Correct goals: Nigeria 1 (ARG 2-1 NIG)          │
│  + 2 pts  Correct result: Brazil win (BRA 3-0 MEX)        │
│  + 1 pt   Correct goals: Brazil 3 (BRA 3-0 MEX)           │
│  + 0 pts  Wrong goals: Mexico (predicted 1, actual 0)     │
│  ...                                                       │
│  + 1 pt   Argentina advanced from group (Group A)          │
│  + 1 pt   Argentina correct position: 1st (Group A)        │
│  ...                                                       │
└────────────────────────────────────────────────────────────┘
```

---

### 7. Match Detail Page (`/match/:matchId`)

**Public**

```
┌─────────────────────────────────────────────────────────────┐
│  [Header]                                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│              🇦🇷 ARGENTINA  2 - 1  NIGERIA 🇳🇬               │
│                    FINAL / 90'                              │
│                                                             │
│  📍 MetLife Stadium, New Jersey                             │
│  📅 June 12, 2026 - 3:00 PM (local time)                   │
│  🏆 Group A - Matchday 1                                    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  GOALS                                                      │
│  ⚽ 32' Osimhen (Nigeria)                                   │
│  ⚽ 45' Messi (Argentina)                                   │
│  ⚽ 78' Di María (Argentina)                                │
├─────────────────────────────────────────────────────────────┤
│  LINEUPS (if available)                                     │
│  Argentina: Martínez, Molina, Romero, ...                  │
│  Nigeria: Nwabali, Osayi-Samuel, ...                       │
├─────────────────────────────────────────────────────────────┤
│  YOUR POINTS (if logged in & match finished)       [?]     │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Prediction: Argentina 2 - 0 Nigeria               │    │
│  │  + 2 pts  Correct result (Argentina win)           │    │
│  │  + 1 pt   Correct Argentina goals (2)              │    │
│  │  + 0 pts  Wrong Nigeria goals (predicted 0)        │    │
│  │  ────────────────────────────────                  │    │
│  │  Total: 3 / 4 points                               │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

- [?] button shows popup explaining scoring rules
- If not logged in, "YOUR POINTS" section is hidden
- If match not yet played, shows "Match not started"

---

### 8. Admin Page (`/admin`)

**Admin only**

```
┌─────────────────────────────────────────────────────────────┐
│  [Header]                                                   │
├─────────────────────────────────────────────────────────────┤
│  ADMIN PANEL                                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  INVITE CODES                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  [Generate New Code]                                   │ │
│  │                                                        │ │
│  │  Code        Created      Used By       Status        │ │
│  │  ABC123      2026-02-01   juan@...      ✓ Used        │ │
│  │  XYZ789      2026-02-03   -             Available     │ │
│  │  DEF456      2026-02-05   maria@...     ✓ Used        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  TOURNAMENT CONTROLS                                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Group Stage:    ○ Open  ● Locked                     │ │
│  │  Knockout Stage: ● Closed  ○ Open  ○ Locked           │ │
│  │                                                        │ │
│  │  [Lock Group Stage]  [Open Knockout]  [Lock Knockout] │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  TESTING (Development only)                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  [Generate Random Group Results]                       │ │
│  │  [Generate Random Knockout Results]                    │ │
│  │  [Reset All Match Results]                             │ │
│  │  [Reset Tournament State]                              │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### Route Summary

| Route             | Page             | Access                               |
| ----------------- | ---------------- | ------------------------------------ |
| `/`               | Home             | Public                               |
| `/login`          | Login            | Public                               |
| `/signup`         | Signup           | Public (with invite code)            |
| `/settings`       | Settings         | Authenticated                        |
| `/predictions`    | My Predictions   | Authenticated                        |
| `/user/:userId`   | User Predictions | Public (blurred before stage starts) |
| `/match/:matchId` | Match Detail     | Public                               |
| `/admin`          | Admin Panel      | Admin only                           |

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

- **On-demand fetching:** Server fetches from Football-Data.org API only when client requests data
- **1-minute cache:** If cached data is less than 1 minute old, serve from cache; otherwise fetch fresh
- Results stored in `matches_cache` table with `updated_at` timestamp
- This limits API usage to max ~1 req/min regardless of user count

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
