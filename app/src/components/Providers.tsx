"use client";

import { SimulationProvider } from "@/contexts/SimulationContext";
import { MatchProvider } from "@/contexts/MatchContext";
import { PredictionsProvider } from "@/contexts/PredictionsContext";
import { ScoringProvider } from "@/contexts/ScoringContext";
import { UserProvider } from "@/contexts/UserContext";
import Header from "@/components/Header";

interface ProvidersProps {
  children: React.ReactNode;
}

/**
 * Client-side providers wrapper
 * Wraps the entire app with necessary context providers
 *
 * Provider order:
 * 1. SimulationProvider - Testing simulation state (admin only)
 * 2. MatchProvider - Global match data with live polling (uses simulation)
 * 3. UserProvider - Current authenticated user
 * 4. PredictionsProvider - User predictions cache
 * 5. ScoringProvider - Score calculations (depends on 2 & 4)
 *
 * Header is rendered here so it persists across page navigations
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <SimulationProvider>
      <MatchProvider>
        <UserProvider>
          <PredictionsProvider>
            <ScoringProvider>
              <Header />
              {children}
            </ScoringProvider>
          </PredictionsProvider>
        </UserProvider>
      </MatchProvider>
    </SimulationProvider>
  );
}
