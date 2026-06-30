"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDatabaseService } from "@/contexts/DatabaseContext";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Competition } from "@/types/database";
import { useUser } from "@/contexts/UserContext";
import SimulationPanel from "@/components/admin/SimulationPanel";
import MatchDataPanel from "@/components/admin/MatchDataPanel";
import CompetitionPicker from "@/components/admin/CompetitionPicker";
import InviteCodesPanel from "@/components/admin/InviteCodesPanel";
import UsersPanel from "@/components/admin/UsersPanel";
import SummaryPanel from "@/components/admin/SummaryPanel";

export default function AdminPage() {
  const router = useRouter();
  const db = useDatabaseService();
  const { user: profile, loading: userLoading } = useUser();

  // Shared competition state (used by invite codes + users panels)
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [competitionsLoading, setCompetitionsLoading] = useState(true);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!userLoading && !profile) {
      router.push("/login");
      return;
    }
    if (!userLoading && profile && !profile.is_admin) {
      router.push("/");
      return;
    }

    if (!profile?.is_admin) return;

    const loadCompetitions = async () => {
      const { data: compsData } = await db.competitions.getAll();
      const loaded = compsData || [];
      setCompetitions(loaded);
      setCompetitionsLoading(false);

      if (loaded.length > 0 && !selectedCompetitionId) {
        setSelectedCompetitionId(loaded[0].id);
      }
    };

    loadCompetitions();
  }, [db, router, profile, userLoading, selectedCompetitionId]);

  const handleCompetitionCreated = (competition: Competition) => {
    setCompetitions([competition, ...competitions]);
    setSelectedCompetitionId(competition.id);
  };

  const selectedCompetitionName = competitions.find(
    (c) => c.id === selectedCompetitionId,
  )?.name;

  if (userLoading) {
    return <LoadingSpinner />;
  }

  if (!profile || !profile.is_admin) {
    return null;
  }

  return (
    <div className="min-h-screen">
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6 text-white">Admin Panel</h1>

        <SimulationPanel />

        <MatchDataPanel />

        <SummaryPanel />

        <CompetitionPicker
          competitions={competitions}
          competitionsLoading={competitionsLoading}
          selectedCompetitionId={selectedCompetitionId}
          onSelectCompetition={setSelectedCompetitionId}
          onCompetitionCreated={handleCompetitionCreated}
        />

        <InviteCodesPanel
          selectedCompetitionId={selectedCompetitionId}
          competitionName={selectedCompetitionName}
        />

        <UsersPanel selectedCompetitionId={selectedCompetitionId} />
      </main>

      <footer className="bg-black/20 text-white py-4 mt-8">
        <div className="container mx-auto px-4 text-center text-sm">
          <p className="text-white/50">WorldCupProde - Admin Panel</p>
        </div>
      </footer>
    </div>
  );
}
