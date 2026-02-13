"use client";

import { useEffect } from "react";
import { DatabaseProvider } from "@/contexts/DatabaseContext";
import { SimulationProvider } from "@/contexts/SimulationContext";
import { TimeProvider } from "@/contexts/TimeContext";
import { MatchProvider } from "@/contexts/MatchContext";
import {
  PredictionsProvider,
  usePredictionsContext,
} from "@/contexts/PredictionsContext";
import { ScoringProvider } from "@/contexts/ScoringContext";
import { LeaderboardProvider } from "@/contexts/LeaderboardContext";
import { UserProvider, useUser } from "@/contexts/UserContext";
import Header from "@/components/Header";
import { PageTransition } from "@/components/PageTransition";

interface ProvidersProps {
  children: React.ReactNode;
}

/**
 * Preloads user predictions when logged in
 * This makes navigation to /predictions instant
 */
function PredictionsPreloader({ children }: { children: React.ReactNode }) {
  const { user, loading: userLoading } = useUser();
  const { getUserPredictions } = usePredictionsContext();

  useEffect(() => {
    // Preload predictions when user is available
    if (!userLoading && user?.id) {
      getUserPredictions(user.id);
    }
  }, [user?.id, userLoading, getUserPredictions]);

  return <>{children}</>;
}

/**
 * Client-side providers wrapper
 * Wraps the entire app with necessary context providers
 *
 * Provider order:
 * 0. DatabaseProvider - Centralized database access (all DB operations go through this)
 * 1. SimulationProvider - Testing simulation state (admin only, controls time/data)
 * 2. TimeProvider - Time functions facade (transparent to components)
 * 3. MatchProvider - Global match data with live polling (uses simulation)
 * 4. UserProvider - Current authenticated user
 * 5. PredictionsProvider - User predictions cache
 * 6. ScoringProvider - Score calculations (depends on 3 & 5)
 * 7. LeaderboardProvider - Centralized leaderboard with positions (auto-refreshes with time)
 *
 * Note: Components should use useTime() for time functions, NOT useSimulation().
 * Only the admin page uses useSimulation() directly to control simulation.
 *
 * Header is rendered here so it persists across page navigations
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <DatabaseProvider>
      <SimulationProvider>
        <TimeProvider>
          <MatchProvider>
            <UserProvider>
              <PredictionsProvider>
                <PredictionsPreloader>
                  <ScoringProvider>
                    <LeaderboardProvider>
                      <Header />
                      <PageTransition>{children}</PageTransition>
                    </LeaderboardProvider>
                  </ScoringProvider>
                </PredictionsPreloader>
              </PredictionsProvider>
            </UserProvider>
          </MatchProvider>
        </TimeProvider>
      </SimulationProvider>
    </DatabaseProvider>
  );
}
