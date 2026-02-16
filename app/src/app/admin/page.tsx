"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDatabaseService } from "@/contexts/DatabaseContext";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Profile, Competition } from "@/types/database";
import { InviteCodeWithUsedBy } from "@/lib/services/database-types";
import { useSimulation } from "@/contexts/SimulationContext";
import { useMatches } from "@/contexts/MatchContext";
import { useUser } from "@/contexts/UserContext";
import { format } from "date-fns";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default function AdminPage() {
  const router = useRouter();
  const db = useDatabaseService();
  const { simulatedDateTime, seed, enableSimulation, disableSimulation } =
    useSimulation();
  const { matches, isSimulated } = useMatches();
  const { user: profile, loading: userLoading } = useUser();

  // Competition management state
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [competitionsLoading, setCompetitionsLoading] = useState(true);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<
    string | null
  >(null);
  const [newCompetitionName, setNewCompetitionName] = useState("");
  const [newCompetitionDesc, setNewCompetitionDesc] = useState("");
  const [creatingCompetition, setCreatingCompetition] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [inviteCodes, setInviteCodes] = useState<InviteCodeWithUsedBy[]>([]);
  const [codesLoading, setCodesLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Users management state
  const [users, setUsers] = useState<Profile[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [togglingAdmin, setTogglingAdmin] = useState<string | null>(null);

  // Simulation form state - initialized directly from context values (using local time)
  const getInitialSimDate = () => {
    if (simulatedDateTime) {
      // Format as YYYY-MM-DD in local time
      const d = new Date(simulatedDateTime);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    return "2026-06-15"; // Middle of group stage
  };
  const getInitialSimTime = () => {
    if (simulatedDateTime) {
      // Format as HH:mm in local time
      const d = new Date(simulatedDateTime);
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      return `${hours}:${minutes}`;
    }
    return "18:00";
  };
  const [simDate, setSimDate] = useState<string>(getInitialSimDate);
  const [simTime, setSimTime] = useState<string>(getInitialSimTime);
  const [simSeed, setSimSeed] = useState<string>(seed.toString());

  useEffect(() => {
    // Redirect if not logged in or not admin
    if (!userLoading && !profile) {
      router.push("/login");
      return;
    }
    if (!userLoading && profile && !profile.is_admin) {
      router.push("/");
      return;
    }

    if (!profile?.is_admin) return;

    const loadData = async () => {
      // Load competitions
      const { data: compsData } = await db.competitions.getAll();
      const loadedCompetitions = compsData || [];
      setCompetitions(loadedCompetitions);
      setCompetitionsLoading(false);

      // Auto-select first competition if available
      if (loadedCompetitions.length > 0 && !selectedCompetitionId) {
        setSelectedCompetitionId(loadedCompetitions[0].id);
      }
    };

    loadData();
  }, [db, router, profile, userLoading, selectedCompetitionId]);

  // Load users when competition is selected
  useEffect(() => {
    const loadUsers = async () => {
      if (!selectedCompetitionId || !profile?.is_admin) {
        setUsers([]);
        setUsersLoading(false);
        return;
      }
      setUsersLoading(true);
      const { data: usersData } = await db.profiles.getAllProfiles(
        selectedCompetitionId,
      );
      setUsers(usersData || []);
      setUsersLoading(false);
    };

    loadUsers();
  }, [db, selectedCompetitionId, profile?.is_admin]);

  // Load invite codes when competition is selected
  useEffect(() => {
    const loadCodes = async () => {
      if (!selectedCompetitionId || !profile?.is_admin) {
        setInviteCodes([]);
        setCodesLoading(false);
        return;
      }
      setCodesLoading(true);
      const { data: codesData } =
        await db.inviteCodes.getAllInviteCodesForCompetition(
          selectedCompetitionId,
        );
      setInviteCodes(codesData || []);
      setCodesLoading(false);
    };

    loadCodes();
  }, [db, selectedCompetitionId, profile?.is_admin]);

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
      // Create tournament settings for the new competition
      await db.tournamentSettings.createSettings(data.id);
      setCompetitions([data, ...competitions]);
      setSelectedCompetitionId(data.id);
      setNewCompetitionName("");
      setNewCompetitionDesc("");
    }

    setCreatingCompetition(false);
  };

  const handleGenerateCode = async () => {
    if (!profile || !selectedCompetitionId) return;
    setGenerating(true);

    const code = generateCode();
    const { data, error } = await db.inviteCodes.createInviteCode(
      code,
      profile.id,
      selectedCompetitionId,
    );

    if (!error && data) {
      setInviteCodes([
        { ...data, used_by_profile: null, competition: null },
        ...inviteCodes,
      ]);
    }

    setGenerating(false);
  };

  const handleCopyInviteLink = async (code: string) => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const inviteLink = `${baseUrl}/signup?code=${code}&competition=${selectedCompetitionId}`;

    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleMakeAdmin = async (userId: string) => {
    setTogglingAdmin(userId);

    const result = await db.profiles.updateProfile(userId, { is_admin: true });

    if (result.success) {
      setUsers(
        users.map((u) => (u.id === userId ? { ...u, is_admin: true } : u)),
      );
    }

    setTogglingAdmin(null);
  };

  const handleEnableSimulation = () => {
    if (!simDate || !simTime) return;
    const [year, month, day] = simDate.split("-").map(Number);
    const [hour, minute] = simTime.split(":").map(Number);
    // Create date in local timezone (not UTC)
    const dateTime = new Date(year, month - 1, day, hour, minute, 0);
    const seedNumber = simSeed ? parseInt(simSeed, 10) : undefined;
    enableSimulation(dateTime, seedNumber);
  };

  const handleRandomizeSeed = () => {
    setSimSeed(Math.floor(Math.random() * 1000000).toString());
  };

  // Calculate simulation stats
  const finishedMatches = matches.filter((m) => m.status === "FINISHED").length;
  const liveMatchCount = matches.filter(
    (m) => m.status === "IN_PLAY" || m.status === "PAUSED",
  ).length;
  const scheduledMatches = matches.filter(
    (m) => m.status === "SCHEDULED" || m.status === "TIMED",
  ).length;

  // Redirect guards (don't block on codes loading)
  if (userLoading) {
    return <LoadingSpinner />;
  }

  if (!profile || !profile.is_admin) {
    return null; // Redirect will happen via useEffect
  }

  return (
    <div className="min-h-screen">
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6 text-white">Admin Panel</h1>

        {/* Simulation Mode - Testing Only */}
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
                Generate random match results for testing. API data is
                overridden.
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

        {/* Competitions Management */}
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
                  onClick={() => setSelectedCompetitionId(comp.id)}
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
                        <p className="text-sm text-white/50">
                          {comp.description}
                        </p>
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

        {/* Invite Codes (scoped to selected competition) */}
        <section className="glass-card p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-bold text-white">Invite Codes</h2>
              {selectedCompetitionId && (
                <p className="text-sm text-white/50">
                  For:{" "}
                  {
                    competitions.find((c) => c.id === selectedCompetitionId)
                      ?.name
                  }
                </p>
              )}
            </div>
            <button
              onClick={handleGenerateCode}
              disabled={generating || !selectedCompetitionId}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
            >
              {generating ? "Generating..." : "Generate Invite Link"}
            </button>
          </div>

          {!selectedCompetitionId ? (
            <div className="py-8 text-center text-white/50">
              Select a competition above to manage invite codes
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 px-4 text-white/60">Code</th>
                    <th className="text-left py-2 px-4 text-white/60">
                      Created
                    </th>
                    <th className="text-left py-2 px-4 text-white/60">
                      Used By
                    </th>
                    <th className="text-left py-2 px-4 text-white/60">
                      Status
                    </th>
                    <th className="text-left py-2 px-4 text-white/60">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {codesLoading ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-8 text-center text-white/50"
                      >
                        Loading invite codes...
                      </td>
                    </tr>
                  ) : inviteCodes.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-8 text-center text-white/50"
                      >
                        No invite codes yet for this competition
                      </td>
                    </tr>
                  ) : (
                    inviteCodes.map((code) => (
                      <tr
                        key={code.id}
                        className="border-b border-white/5 hover:bg-white/5"
                      >
                        <td className="py-2 px-4 font-mono font-bold text-white">
                          {code.code}
                        </td>
                        <td className="py-2 px-4 text-white/70">
                          {format(new Date(code.created_at), "MMM d, yyyy")}
                        </td>
                        <td className="py-2 px-4 text-white/70">
                          {code.used_by_profile?.display_name || "-"}
                        </td>
                        <td className="py-2 px-4">
                          {code.used_by ? (
                            <span className="px-2 py-1 bg-white/10 text-white/50 rounded text-xs">
                              Used
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                              Available
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-4">
                          {!code.used_by && (
                            <button
                              onClick={() => handleCopyInviteLink(code.code)}
                              className="px-3 py-1 rounded text-xs transition bg-blue-600/20 text-blue-400 hover:bg-blue-600/30"
                            >
                              {copiedCode === code.code
                                ? "Copied!"
                                : "Copy Link"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Users Management */}
        <section className="glass-card p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Users Management</h2>
            <span className="text-sm text-white/50">{users.length} users</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-4 text-white/60">Name</th>
                  <th className="text-left py-2 px-4 text-white/60">Email</th>
                  <th className="text-left py-2 px-4 text-white/60">Joined</th>
                  <th className="text-left py-2 px-4 text-white/60">Admin</th>
                  <th className="text-left py-2 px-4 text-white/60">Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersLoading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-white/50">
                      Loading users...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-white/50">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr
                      key={user.id}
                      className={`border-b border-white/5 hover:bg-white/5 ${
                        user.id === profile?.id ? "bg-emerald-500/10" : ""
                      }`}
                    >
                      <td className="py-2 px-4 font-medium text-white">
                        {user.display_name}
                        {user.id === profile?.id && (
                          <span className="ml-2 text-xs text-emerald-400">
                            (you)
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-4 text-white/70">{user.email}</td>
                      <td className="py-2 px-4 text-white/70">
                        {format(new Date(user.created_at), "MMM d, yyyy")}
                      </td>
                      <td className="py-2 px-4">
                        {user.is_admin ? (
                          <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs">
                            Admin
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-white/10 text-white/50 rounded text-xs">
                            User
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-4">
                        {user.is_admin ? (
                          <span className="text-white/30 text-xs">-</span>
                        ) : (
                          <button
                            onClick={() => handleMakeAdmin(user.id)}
                            disabled={togglingAdmin === user.id}
                            className="px-3 py-1 rounded text-xs transition bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 disabled:opacity-50"
                          >
                            {togglingAdmin === user.id ? "..." : "Make Admin"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <footer className="bg-black/20 text-white py-4 mt-8">
        <div className="container mx-auto px-4 text-center text-sm">
          <p className="text-white/50">WorldCupProde - Admin Panel</p>
        </div>
      </footer>
    </div>
  );
}
