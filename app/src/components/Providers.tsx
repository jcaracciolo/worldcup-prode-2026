"use client";

import { MatchProvider } from "@/contexts/MatchContext";

interface ProvidersProps {
  children: React.ReactNode;
}

/**
 * Client-side providers wrapper
 * Wraps the entire app with necessary context providers
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <MatchProvider>
      {children}
    </MatchProvider>
  );
}
