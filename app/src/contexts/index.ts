/**
 * Centralized context exports
 *
 * Provider hierarchy (in Providers.tsx):
 * 1. SimulationProvider - Testing simulation state (admin only)
 * 2. MatchProvider - Global match data with live polling
 * 3. PredictionsProvider - User predictions cache
 * 4. ScoringProvider - Score calculations (depends on 2 & 3)
 */

// Simulation Context - Testing simulation state
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
