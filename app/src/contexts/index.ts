/**
 * Centralized context exports
 *
 * Provider hierarchy (in Providers.tsx):
 * 1. SimulationProvider - Testing simulation state (admin only)
 * 2. TimeProvider - Time functions facade (transparent to components)
 * 3. MatchProvider - Global match data with live polling
 * 4. UserProvider - Current authenticated user
 * 5. PredictionsProvider - User predictions cache
 * 6. ScoringProvider - Score calculations (depends on 3 & 5)
 *
 * NOTE: Components should use useTime() for time functions, NOT useSimulation().
 * Only the admin page uses useSimulation() directly to control simulation.
 */

// Time Context - Application time (simulation-transparent)
export { TimeProvider, useTime } from "./TimeContext";

// Simulation Context - Testing simulation state (admin only)
export {
  SimulationProvider,
  useSimulation,
  type SimulationState,
} from "./SimulationContext";

// Match Context - Global match data with live polling
export {
  MatchProvider,
  useMatches,
  type MatchWithLiveInfo,
} from "./MatchContext";

// User Context - Current authenticated user
export { UserProvider, useUser } from "./UserContext";

// Predictions Context - User predictions cache
export {
  PredictionsProvider,
  usePredictionsContext,
  useUserPredictions,
  type UserPredictions,
} from "./PredictionsContext";

// Scoring Context - Score calculations
export {
  ScoringProvider,
  useScoringContext,
  useUserScore,
  useMatchScore,
  type ScoreBreakdown,
  type UserScore,
} from "./ScoringContext";
