"use client";

import { useState } from "react";
import { useDatabaseService } from "@/contexts/DatabaseContext";
import { useUser } from "@/contexts/UserContext";
import { Competition } from "@/types/database";
import { format } from "date-fns";

interface CompetitionPickerProps {
  competitions: Competition[];
  competitionsLoading: boolean;
  selectedCompetitionId: string | null;
  onSelectCompetition: (id: string) => void;
  onCompetitionCreated: (competition: Competition) => void;
}

export default function CompetitionPicker({
  competitions,
  competitionsLoading,
  selectedCompetitionId,
  onSelectCompetition,
  onCompetitionCreated,
}: CompetitionPickerProps) {
  const db = useDatabaseService();
  const { user: profile } = useUser();

  const [newCompetitionName, setNewCompetitionName] = useState("");
  const [newCompetitionDesc, setNewCompetitionDesc] = useState("");
  const [creatingCompetition, setCreatingCompetition] = useState(false);

  const handleCreateCompetition = async () => {
    if (!profile || !newCompetitionName.trim()) return;
    setCreatingCompetition(true);

    const { data, error } = await db.competitions.create(
      newCompetitionName.trim(),
      newCompetitionDesc.trim() || null,
      2398, // Default World Cup 2026 season ID
      profile.id,
    );

    if (!error && data) {
      await db.tournamentSettings.createSettings(data.id);
      onCompetitionCreated(data);
      setNewCompetitionName("");
      setNewCompetitionDesc("");
    }

    setCreatingCompetition(false);
  };

  return (
    <section className="glass-card p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">Competitions</h2>
        <span className="text-sm text-white/50">
          {competitions.length} competition
          {competitions.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Create new competition */}
      <div className="bg-white/5 rounded-lg p-4 mb-4">
        <h3 className="text-sm font-medium text-white/70 mb-3">
          Create New Competition
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <input
              type="text"
              value={newCompetitionName}
              onChange={(e) => setNewCompetitionName(e.target.value)}
              placeholder="Competition name"
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <input
              type="text"
              value={newCompetitionDesc}
              onChange={(e) => setNewCompetitionDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <button
              onClick={handleCreateCompetition}
              disabled={creatingCompetition || !newCompetitionName.trim()}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {creatingCompetition ? "Creating..." : "Create Competition"}
            </button>
          </div>
        </div>
      </div>

      {/* Competition list */}
      {competitionsLoading ? (
        <div className="py-8 text-center text-white/50">
          Loading competitions...
        </div>
      ) : competitions.length === 0 ? (
        <div className="py-8 text-center text-white/50">
          No competitions yet. Create one above.
        </div>
      ) : (
        <div className="space-y-2">
          {competitions.map((comp) => (
            <div
              key={comp.id}
              onClick={() => onSelectCompetition(comp.id)}
              className={`p-4 rounded-lg cursor-pointer transition ${
                selectedCompetitionId === comp.id
                  ? "bg-emerald-600/20 border border-emerald-500/50"
                  : "bg-white/5 hover:bg-white/10 border border-transparent"
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium text-white">{comp.name}</h3>
                  {comp.description && (
                    <p className="text-sm text-white/50">{comp.description}</p>
                  )}
                </div>
                <div className="text-xs text-white/40">
                  Created {format(new Date(comp.created_at), "MMM d, yyyy")}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
