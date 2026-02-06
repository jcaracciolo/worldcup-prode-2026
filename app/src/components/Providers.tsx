"use client";

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
 * 1. MatchProvider - Global match data with live polling
 * 2. PredictionsProvider - User predictions cache
 * 3. ScoringProvider - Score calculations (depends on 1 & 2)
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <MatchProvider>
      <PredictionsProvider>
        <ScoringProvider>
          {children}
        </ScoringProvider>
      </PredictionsProvider>
    </MatchProvider>
  );
}
