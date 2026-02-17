"use client";

import { useState } from "react";
import { useSimulation } from "@/contexts/SimulationContext";
import { useMatches } from "@/contexts/MatchContext";
import { format } from "date-fns";

function getInitialSimDate(simulatedDateTime: Date | null): string {
  if (simulatedDateTime) {
    const d = new Date(simulatedDateTime);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return "2026-06-15"; // Middle of group stage
}

function getInitialSimTime(simulatedDateTime: Date | null): string {
  if (simulatedDateTime) {
    const d = new Date(simulatedDateTime);
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }
  return "18:00";
}

export default function SimulationPanel() {
  const { simulatedDateTime, seed, enableSimulation, disableSimulation } =
    useSimulation();
  const { matches, isSimulated } = useMatches();

  const [simDate, setSimDate] = useState<string>(() =>
    getInitialSimDate(simulatedDateTime),
  );
  const [simTime, setSimTime] = useState<string>(() =>
    getInitialSimTime(simulatedDateTime),
  );
  const [simSeed, setSimSeed] = useState<string>(seed.toString());

  const handleEnableSimulation = () => {
    if (!simDate || !simTime) return;
    const [year, month, day] = simDate.split("-").map(Number);
    const [hour, minute] = simTime.split(":").map(Number);
    const dateTime = new Date(year, month - 1, day, hour, minute, 0);
    const seedNumber = simSeed ? parseInt(simSeed, 10) : undefined;
    enableSimulation(dateTime, seedNumber);
  };

  const handleRandomizeSeed = () => {
    setSimSeed(Math.floor(Math.random() * 1000000).toString());
  };

  const finishedMatches = matches.filter((m) => m.status === "FINISHED").length;
  const liveMatchCount = matches.filter(
    (m) => m.status === "IN_PLAY" || m.status === "PAUSED",
  ).length;
  const scheduledMatches = matches.filter(
    (m) => m.status === "SCHEDULED" || m.status === "TIMED",
  ).length;

  return (
    <section
      className={`glass-card p-6 mb-6 ${isSimulated ? "ring-2 ring-amber-500" : ""}`}
    >
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            🧪 Simulation Mode
            {isSimulated && (
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-sm rounded">
                ACTIVE
              </span>
            )}
          </h2>
          <p className="text-sm text-white/50 mt-1">
            Generate random match results for testing. API data is overridden.
          </p>
        </div>
        {isSimulated && (
          <button
            onClick={disableSimulation}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Disable Simulation
          </button>
        )}
      </div>

      {isSimulated && simulatedDateTime && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-4">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-white/50">Simulated Time:</span>
              <span className="ml-2 text-amber-400 font-mono">
                {format(simulatedDateTime, "PPP 'at' HH:mm")}
              </span>
            </div>
            <div>
              <span className="text-white/50">Seed:</span>
              <span className="ml-2 text-amber-400 font-mono">{seed}</span>
            </div>
            <div>
              <span className="text-white/50">Finished:</span>
              <span className="ml-2 text-white">{finishedMatches}</span>
            </div>
            <div>
              <span className="text-white/50">Live:</span>
              <span className="ml-2 text-green-400">{liveMatchCount}</span>
            </div>
            <div>
              <span className="text-white/50">Scheduled:</span>
              <span className="ml-2 text-white/70">{scheduledMatches}</span>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-white/50 mb-1">Date</label>
            <input
              type="date"
              value={simDate}
              onChange={(e) => setSimDate(e.target.value)}
              min="2026-06-11"
              max="2026-07-19"
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-white/50 mb-1">
              Time (Local)
            </label>
            <input
              type="time"
              value={simTime}
              onChange={(e) => setSimTime(e.target.value)}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-white/50 mb-1">
              Seed (for reproducible results)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={simSeed}
                onChange={(e) => setSimSeed(e.target.value)}
                placeholder="12345"
                className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleRandomizeSeed}
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white/70 hover:bg-white/20 transition"
                title="Randomize seed"
              >
                🎲
              </button>
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleEnableSimulation}
              disabled={!simDate || !simTime}
              className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition disabled:opacity-50"
            >
              {isSimulated ? "Update Simulation" : "Enable Simulation"}
            </button>
          </div>
        </div>

        <div className="text-xs text-white/40 space-y-1">
          <p>• Tournament runs from June 11 - July 19, 2026</p>
          <p>• Group stage: June 11 - June 28 (72 matches)</p>
          <p>• Knockout stage: June 29 - July 19 (32 matches)</p>
          <p>• Changing the seed generates different random scores</p>
        </div>
      </div>
    </section>
  );
}
