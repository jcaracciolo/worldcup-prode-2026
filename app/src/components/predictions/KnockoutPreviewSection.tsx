"use client";

import { Match, CalculatedStanding } from "@/types/football";
import R32Preview from "@/components/R32Preview";

interface KnockoutPreviewSectionProps {
  knockoutStages: Map<string, Match[]>;
  groupStandings: Map<string, CalculatedStanding[]>;
  thirdPlaceQualifying: Map<string, boolean>;
}

function getKnockoutStageName(stage: string): string {
  const names: Record<string, string> = {
    LAST_32: "Round of 32",
    LAST_16: "Round of 16",
    QUARTER_FINALS: "Quarter Finals",
    SEMI_FINALS: "Semi Finals",
    THIRD_PLACE: "Third Place",
    FINAL: "Final",
  };
  return names[stage] || stage;
}

export default function KnockoutPreviewSection({
  knockoutStages,
  groupStandings,
  thirdPlaceQualifying,
}: KnockoutPreviewSectionProps) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
          <span className="text-xl">⚔️</span>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Knockout Stage</h2>
          <p className="text-white/50 text-sm">Single elimination rounds</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* R32 Preview - Shows teams based on group predictions */}
        <R32Preview
          matches={knockoutStages.get("LAST_32") || []}
          groupStandings={groupStandings}
          thirdPlaceQualifying={thirdPlaceQualifying}
        />

        {/* Blurred rest of knockout */}
        <div className="relative">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-10 rounded-xl flex items-center justify-center">
            <div className="text-center">
              <div className="text-5xl mb-4">🔒</div>
              <p className="text-white/60 text-lg">
                Coming soon after group stage locks
              </p>
            </div>
          </div>
          <div className="space-y-6 opacity-50">
            {["LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"].map(
              (stage) => {
                const stageName = getKnockoutStageName(stage);
                return (
                  <div key={stage} className="glass-card p-5">
                    <h3 className="font-bold text-lg mb-4 text-white">
                      {stageName}
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4 h-20">
                      {/* Placeholder boxes */}
                      <div className="bg-white/5 rounded-lg h-12"></div>
                      <div className="bg-white/5 rounded-lg h-12"></div>
                    </div>
                  </div>
                );
              },
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
