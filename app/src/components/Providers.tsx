"use client";

import { SimulationProvider } from "@/contexts/SimulationContext";
import { MatchProvider } from "@/contexts/MatchContext";
import { PredictionsProvider } from "@/contexts/PredictionsContext";
import { ScoringProvider } from "@/contexts/ScoringContext";

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
 * 3. PredictionsProvider - User predictions cache
 * 4. ScoringProvider - Score calculations (depends on 2 & 3)
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <SimulationProvider>
      <MatchProvider>
        <PredictionsProvider>
          <ScoringProvider>
            {children}
          </ScoringProvider>
        </PredictionsProvider>
      </MatchProvider>
    </SimulationProvider>
  );
}
