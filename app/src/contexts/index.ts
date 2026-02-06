/**
 * Centralized context exports
 *
 * Provider hierarchy (in Providers.tsx):
 * 1. MatchProvider - Global match data with live polling
 * 2. PredictionsProvider - User predictions cache
 * 3. ScoringProvider - Score calculations (depends on 1 & 2)
 */

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
