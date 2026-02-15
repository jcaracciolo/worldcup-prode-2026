# WorldCupProde — Architecture Overview

## Provider Hierarchy (Data Flow Foundation)

All data flows through a nested context provider tree defined in `Providers.tsx`. The nesting order matters — each provider can only consume contexts above it.

```
DatabaseProvider              ← Supabase client + competition switching
  └─ SimulationProvider       ← Admin-only: fake time/match data for testing
       └─ TimeProvider        ← Facade over simulation; provides getCurrentTime() + stage locks
            └─ MatchProvider  ← Fetches matches from API, enhances with live info, resolves knockout bracket
                 └─ UserProvider          ← Auth state + current user profile
                      └─ PredictionsProvider  ← User predictions cache (per-user and all-users)
                           └─ ScoringProvider     ← Score calculations (group + knockout + bonus)
                                └─ LeaderboardProvider  ← Aggregated scores + positions for all users
```

The `Header` component and `PageTransition` wrapper are rendered **inside** all providers, so every page and the header have access to everything.

---

## Layer 1: DatabaseProvider (`contexts/DatabaseContext.tsx`)

**What it provides:** `useDatabase()`, `useDatabaseService()`

**Data source:** Supabase browser client, created via `createBrowserClient()`

**Responsibilities:**

- Creates a `DatabaseService` instance (the single entry point for ALL database operations)
- Manages **competition switching** (multi-competition support)
- Persists selected competition ID to localStorage
- Loads the user's competition list on auth

**What consumers get:**
| Hook | Returns |
|------|---------|
| `useDatabaseService()` | `db` — the service object with sub-services |
| `useDatabase()` | `db` + `currentCompetitionId` + `switchCompetition()` + `userCompetitions` |

**Database service structure** (`db.*`):

```
db.auth          → getUser(), signIn(), signUp(), signOut(), onAuthStateChange()
db.profiles      → getProfile(), getAllProfiles(), updateProfile()
db.competitions  → getAll(), getById(), create(), update()
db.members       → getMemberships(), addMember(), removeMember()
db.predictions   → getUserPredictions(), getAllPredictions(), savePredictions()
db.overrides     → getUserOverrides(), getAllOverrides(), saveOverrides()
db.inviteCodes   → getByCode(), create(), markUsed()
db.matchesCache  → getCachedMatches(), updateMatchesCache(), ...
db.settings      → getSettings(), updateSettings()
```

**Key design:** The `db` object is recreated (via `useMemo`) whenever `currentCompetitionId` changes. This means any context that depends on `db` will automatically re-fetch when the user switches competitions.

---

## Layer 2: SimulationProvider (`contexts/SimulationContext.tsx`)

**What it provides:** `useSimulation()` (used only by `TimeProvider` and admin page)

**Data source:** localStorage (persisted simulation state) + seeded random number generator

**Responsibilities:**

- Provides `getCurrentTime()` — returns real `new Date()` or simulated time
- Generates fake match results for simulated dates (using seeded RNG for reproducibility)
- Computes `stageLockStatus` based on current time (real or simulated)
- `applySimulation(matches)` — takes real matches and overlays simulated scores

**Key design:** Components should **never** call `useSimulation()` directly. They use `useTime()` instead, which is a transparent facade.

---

## Layer 3: TimeProvider (`contexts/TimeContext.tsx`)

**What it provides:** `useTime()`

**Data source:** Delegates to `useSimulation()` internally

**Responsibilities:**

- Exposes `getCurrentTime()`, `stageLockStatus`, `isMatchLocked(utcDate)`, `isSimulated`
- Controls the global **tick counter** that drives periodic updates:
  - Real mode: ticks every **60 seconds** (API polling pace)
  - Simulation mode: ticks every **5 seconds** (fast-forward)
- `MatchProvider` watches `tick` to know when to re-fetch

**What consumers get:**

```ts
const { getCurrentTime, stageLockStatus, isMatchLocked, tick, isSimulated } =
  useTime();

stageLockStatus = {
  groupStageLocked: boolean, // true after group stage deadline
  knockoutStageOpen: boolean, // true when knockout predictions open
  knockoutStageLocked: boolean, // true after knockout deadline
  daysUntilKnockoutLocks: number | null,
};
```

---

## Layer 4: MatchProvider (`contexts/MatchContext.tsx`)

**What it provides:** `useMatches()`, `useKnockoutTeams(...)`

**Data source:** `/api/matches` route → Football API (football-data.org) → cached in Supabase

**The API boundary — ID conversion:**
The external API uses arbitrary numeric IDs. The API route (`/api/matches/route.ts`) is the **only** place that translates API IDs → FIFA match numbers (1-104). Every consumer below this point sees `match.id` as the FIFA number.

```
Football API (external)  →  /api/matches route  →  MatchProvider  →  All components
   API IDs (e.g. 502341)      converts to FIFA IDs    match.id = 37 (FIFA #37)
```

**Responsibilities:**

- Fetches matches from `/api/matches` on mount
- Re-fetches on every `tick` (if live matches exist or matches are scheduled today)
- Enhances each match with: `isLive`, `elapsedMinutes`, `period`, `fifaNumber`, `venueDisplay`
- Computes **actual group standings** from finished match results
- Computes **actual third-place qualifying** from those standings
- Runs `BracketResolver` with **actual data only** to produce `resolvedKnockoutTeams`
- In simulation mode: applies simulated scores before processing

**What consumers get:**

```ts
const {
  matches, // MatchWithLiveInfo[] — all 104 matches with live info
  hasLiveMatches, // boolean
  liveMatches, // MatchWithLiveInfo[]
  loading,
  error,
  lastUpdated,
  refresh, // manual re-fetch
  isSimulated,
  resolvedKnockoutTeams, // Map<FifaMatchId, { home: Team | null, away: Team | null }>
  actualGroupStandings, // Map<groupName, CalculatedStanding[]>
  actualThirdPlaceQualifying, // Map<groupName, boolean>
} = useMatches();
```

### `useKnockoutTeams()` hook

This hook centralizes knockout bracket resolution. It has two modes:

```ts
// Mode 1: No args → returns actual resolved teams from context
const resolvedTeams = useKnockoutTeams();

// Mode 2: With knockout predictions → BracketResolver uses actual group standings
// for R32, and knockout predictions to cascade R16+
const resolvedTeams = useKnockoutTeams(knockoutPredictions);
```

**Key design decisions:**

- R32 teams are **always** resolved from actual data (API teams → actual group standings → TBD)
- R16+ teams use actual match winners when available, then fall back to knockout predictions
- Group predictions are **never** used for knockout bracket resolution — they only affect group bonus scoring
- Returns `Map<FifaMatchId, ResolvedTeams>` directly (not wrapped in an object)

Used by `KnockoutStageSection` (the only caller). The section passes the result down to `KnockoutMatchRow` via a simple `resolvedTeams` prop.

---

## Layer 5: UserProvider (`contexts/UserContext.tsx`)

**What it provides:** `useUser()`, `useProfile(userId)`, `useAllProfiles()`

**Data source:** `db.auth` + `db.profiles`

**Responsibilities:**

- Fetches current user profile on mount and auth state changes
- Provides `getProfile(userId)` and `getAllProfiles()`
- `useProfile(userId)` returns `LCE<Profile>` (Loading-Content-Error pattern)
- `useAllProfiles()` returns `LCE<Profile[]>` — used by LeaderboardContext and match detail page

**LCE pattern:**

```ts
interface LCE<T> {
  loading: boolean;
  content: T | null;
  error: string | null;
}
```

---

## Layer 6: PredictionsProvider (`contexts/PredictionsContext.tsx`)

**What it provides:** `usePredictionsContext()`, `useUserPredictions(userId)`, `useAllPredictions()`

**Data source:** `db.predictions` + `db.overrides`

**Responsibilities:**

- `getUserPredictions(userId)` — returns `{ predictions: Map<FifaMatchId, LocalPrediction>, overrides }`, cached in state
- `getAllPredictions()` — returns `Map<userId, { predictions[], overrides[] }>` for all users
- `savePredictions(userId, predictions, overrides)` — writes to DB
- `useAllPredictions()` — returns `LCE<Map<...>>` hook for reactive all-predictions

**Preloading:** `PredictionsPreloader` (in `Providers.tsx`) calls `getUserPredictions(user.id)` as soon as the user is authenticated, making navigation to `/predictions` instant.

**Key types:**

```ts
interface LocalPrediction {
  match_id: number; // FIFA match number (1-104)
  home_goals: number | null;
  away_goals: number | null;
  winner_id: number | null; // For knockout tiebreakers
}

interface LocalGroupStandingsOverride {
  group_name: string;
  team_id: number;
  position: number; // Manual position override by user
}
```

---

## Layer 7: ScoringProvider (`contexts/ScoringContext.tsx`)

**What it provides:** `useScoringContext()`, `useUserScore()`, `useMatchScore()`

**Data source:** `useMatches()` (match results) + `useUserPredictions()` (logged-in user's predictions)

**Responsibilities:**

- `calculateUserScore(userId, predictions, overrides)` — computes full breakdown
- `getMatchScore(matchId, prediction)` — points for a single match
- `calculatePredictedStandings(group, predictions, overrides)` — group table from predictions
- `getActualGroupStandings(group)` — group table from actual results
- `getAdvancingTeamIds()` — set of team IDs that advanced from groups (actual)

**Scoring types:**

```ts
interface PointBreakdown {
  type: "exact" | "result" | "correct_diff" | "knockout_win" | "group_advance" | ...;
  points: number;
  matchId?: number;
}
```

---

## Layer 8: LeaderboardProvider (`contexts/LeaderboardContext.tsx`)

**What it provides:** `useLeaderboard()`, `useUserPosition(userId)`

**Data source:** `useAllProfiles()` + `useAllPredictions()` + `useMatches()` + `useTime()`

**Responsibilities:**

- Computes scores for ALL users by iterating profiles × predictions × matches
- Assigns positions (1st, 2nd, 3rd...) with tie handling
- Loading state derived from LCE hooks (`profiles.loading || allPredictions.loading`)
- Re-calculates via `useMemo` when any dependency changes

**What consumers get:**

```ts
const { scores, loading, getPosition, getUserScore } = useLeaderboard();

// scores: UserScore[] — sorted by totalPoints descending
interface UserScore {
  userId: string;
  displayName: string;
  totalPoints: number;
  livePoints: number;
  groupStagePoints: number;
  groupBonusPoints: number;
  knockoutPoints: number;
  position: number;
}
```

---

## Pages — What They Consume

### Home Page (`/`)

```
useUser()       → current profile (for welcome message)
useLeaderboard() → scores array (top N for sidebar)
useTime()       → daysUntilKnockoutLocks (warning banner)
```

Renders: `TodaysMatches` (fetches from MatchContext internally), `Leaderboard` (receives scores as prop)

---

### Fixtures Page (`/fixtures`)

```
useMatches()    → matches, loading, hasLiveMatches, liveMatches, refresh
useTime()       → getCurrentTime, stageLockStatus
```

- Groups matches by group and knockout stage
- Calculates standings locally from actual results
- `GroupStageSection` — receives groups + standings calculator + readOnly=true
- `KnockoutStageSection` — receives knockoutStages + readOnly=true
  - Internally calls `useKnockoutTeams()` with **no args** → gets actual resolved teams from context

---

### Predictions Page (`/predictions`)

```
useMatches()         → matches, loading, hasLiveMatches, liveMatches, refresh
useTime()            → getCurrentTime, stageLockStatus
useUser()            → current profile
useUserPredictions() → predictions map, overrides, save function
```

- Maintains LOCAL state for predictions (unsaved edits)
- Calculates group standings FROM predictions (what-if) — used for GroupStageSection UI only
- Calculates third-place qualifying FROM predicted standings — used for GroupStageSection highlighting
- `GroupStageSection` — receives groups + predictions + standings calculator + edit handlers
- `KnockoutStageSection` — receives knockoutStages + predictions
  - Internally calls `useKnockoutTeams(predictions)` → R32 from actual standings, R16+ from knockout predictions

---

### User Profile Page (`/user/[userId]`)

```
useMatches()         → matches, actualGroupStandings, actualThirdPlaceQualifying
useTime()            → stageLockStatus
useUser()            → current profile (to check if viewing own)
useProfile(userId)   → target user's profile (LCE)
useUserPredictions() → target user's predictions
useUserPosition()    → target user's leaderboard position
```

- Shows read-only view of another user's predictions
- `UserGroupSection` — shows group predictions with actual standings comparison
- `KnockoutStageSection` — receives knockout predictions
  - Internally calls `useKnockoutTeams(predictions)` → R32 from actual standings, R16+ from knockout predictions
- `PointsBreakdown` — receives calculated points from `calculateTotalPoints()`

---

### Match Detail Page (`/match/[matchId]`)

```
useMatches()         → all matches (finds specific match by FIFA ID)
useUser()            → current profile
useAllProfiles()     → all profiles (LCE)
useAllPredictions()  → all predictions (LCE)
```

- Finds the match by `parseInt(matchId)` (FIFA number)
- Calculates points per user for this specific match
- Sorts: current user first, then by points earned

---

### Admin Page (`/admin`)

```
useSimulation()     → direct control of simulation state (only page that does this)
useTime()           → stage lock status
useMatches()        → for displaying match data
useDatabaseService() → for admin DB operations
```

---

## Component Data Flow

### `KnockoutStageSection` (the most complex component)

```
Page passes:
  knockoutStages       (Map<stage, Match[]>)
  predictions?         (Map<FifaMatchId, LocalPrediction>)   ← knockout predictions
  knockoutLocked?
  onPredictionChange?
  mode?                ("edit" | "fixtures" | "predictions")

Internally calls:
  useKnockoutTeams(predictions)
  → R32 always from actual group standings
  → R16+ from actual winners, or knockout predictions if provided
  → returns Map<FifaMatchId, { home: Team | null, away: Team | null }>

For each match, passes to KnockoutMatchRow:
  match, prediction, resolvedTeams, fifaMatchNumber, mode, onChange, ...
```

### `KnockoutMatchRow` (in `MatchRowShared.tsx`)

```
Receives as props:
  match               (Match)
  resolvedTeams?       ({ home: Team | null, away: Team | null })
  prediction?          (LocalPrediction)
  fifaMatchNumber      (FifaMatchId)
  mode                 ("edit" | "readonly")
  onChange?            (callback)

Does NOT call any context hooks — pure presentational component.

Team resolution fallback:
  home = resolvedTeams?.home || match.homeTeam (API placeholder like "Winner Group A")
  away = resolvedTeams?.away || match.awayTeam
```

### `GroupStageSection`

```
Receives as props:
  groups               (Map<groupName, Match[]>)
  predictions?         (Map<FifaMatchId, LocalPrediction>)
  thirdPlaceQualifying (Map<groupName, boolean>)
  calculateStandings   (function — different per page)
  onPredictionChange?
  onSwapPositions?
  readOnly?

Calls: useTime() for match lock status
```

### `TodaysMatches`

```
Calls: useMatches() → matches, loading, hasLiveMatches, refresh
Calls: useTime()    → getCurrentTime
Renders: MatchCard for each match
```

### `Leaderboard`

```
Receives as props: scores (UserScore[]), currentUserId
Pure presentational — no context hooks
```

### `Header`

```
Calls: useDatabaseService() → for logout
Calls: useDatabase()        → competition switching
Calls: useMatches()         → isSimulated (show simulation banner)
Calls: useUser()            → current user (show name, avatar)
```

---

## Key Libraries

| File                         | Purpose                                                                                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/bracket-resolver.ts`    | Resolves which teams play in each knockout match (R32→Final). Uses group standings + 3rd place ranking + prediction overrides.                             |
| `lib/standings.ts`           | `calculateAllGroupStandings(matches, predictionMap)` — computes group tables from predictions. `calculateAllActualStandings(matches)` — from real results. |
| `lib/third-place-ranking.ts` | `getQualifyingThirdPlaceTeams(standings)` — determines best 8 of 12 third-place teams.                                                                     |
| `lib/r32-bracket.ts`         | FIFA-defined R32 bracket structure (which group winners/runners-up/3rd-place teams go where).                                                              |
| `lib/scoring.ts`             | Point calculation: exact score, correct result, goal difference, group advancement bonus, knockout points.                                                 |
| `lib/tournament.ts`          | Static tournament data: group schedules, knockout schedule, venues, match info by FIFA number.                                                             |
| `lib/time.ts`                | Stage lock date logic (when predictions lock).                                                                                                             |
| `lib/football-api.ts`        | External API client for football-data.org.                                                                                                                 |
| `lib/api-client.ts`          | `buildApiToFifaMapping(matches)` — maps API IDs to FIFA numbers (used only in API route).                                                                  |

---

## Data Identity: FIFA Match Numbers

Every match is identified by its FIFA match number (1-104) throughout the entire client-side app:

- **1-72**: Group stage matches
- **73-88**: Round of 32
- **89-96**: Round of 16
- **97-100**: Quarter Finals
- **101-102**: Semi Finals
- **103**: Third Place
- **104**: Final

The branded type `FifaMatchId` (`number & { __brand: "FifaMatchId" }`) is used to distinguish FIFA IDs from arbitrary numbers at the type level.
