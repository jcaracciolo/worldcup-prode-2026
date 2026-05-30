"use client";

import { useState, useEffect, useMemo } from "react";
import { useUser } from "@/contexts/UserContext";
import { useUserManagement } from "@/hooks/useAuth";
import { useMatches } from "@/contexts/MatchContext";
import { useAllPredictions } from "@/contexts/PredictionsContext";
import { Profile } from "@/types/database";
import { format } from "date-fns";
import UserName from "@/components/UserName";

interface UsersPanelProps {
  selectedCompetitionId: string | null;
}

export default function UsersPanel({
  selectedCompetitionId,
}: UsersPanelProps) {
  const { getAllProfiles, makeAdmin } = useUserManagement();
  const { user: profile } = useUser();

  const [users, setUsers] = useState<Profile[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [togglingAdmin, setTogglingAdmin] = useState<string | null>(null);

  const { matches } = useMatches();
  const allPredictions = useAllPredictions();

  // Count group stage and knockout matches
  const { groupMatchCount, knockoutMatchCount } = useMemo(() => {
    let group = 0;
    let knockout = 0;
    for (const m of matches) {
      if (m.stage === "GROUP_STAGE") group++;
      else knockout++;
    }
    return { groupMatchCount: group, knockoutMatchCount: knockout };
  }, [matches]);

  // Calculate prediction completeness per user
  const predictionStatus = useMemo(() => {
    const predictionsMap = allPredictions.content;
    if (!predictionsMap) return new Map<string, { group: number; knockout: number }>();

    const status = new Map<string, { group: number; knockout: number }>();
    const groupMatchIds = new Set(
      matches.filter((m) => m.stage === "GROUP_STAGE").map((m) => m.id),
    );

    predictionsMap.forEach((userData, userId) => {
      let groupComplete = 0;
      let knockoutComplete = 0;
      for (const p of userData.predictions) {
        if (p.home_goals !== null && p.away_goals !== null) {
          if (groupMatchIds.has(p.match_id)) groupComplete++;
          else knockoutComplete++;
        }
      }
      status.set(userId, { group: groupComplete, knockout: knockoutComplete });
    });

    return status;
  }, [allPredictions.content, matches]);

  useEffect(() => {
    const loadUsers = async () => {
      if (!selectedCompetitionId || !profile?.is_admin) {
        setUsers([]);
        setUsersLoading(false);
        return;
      }
      setUsersLoading(true);
      const { data: usersData } = await getAllProfiles(
        selectedCompetitionId,
      );
      setUsers(usersData || []);
      setUsersLoading(false);
    };

    loadUsers();
  }, [getAllProfiles, selectedCompetitionId, profile?.is_admin]);

  const handleMakeAdmin = async (userId: string) => {
    setTogglingAdmin(userId);

    const result = await makeAdmin(userId);

    if (result.success) {
      setUsers(
        users.map((u) => (u.id === userId ? { ...u, is_admin: true } : u)),
      );
    }

    setTogglingAdmin(null);
  };

  return (
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
              <th className="text-center py-2 px-4 text-white/60">Group</th>
              <th className="text-center py-2 px-4 text-white/60">Knockout</th>
              <th className="text-left py-2 px-4 text-white/60">Admin</th>
              <th className="text-left py-2 px-4 text-white/60">Actions</th>
            </tr>
          </thead>
          <tbody>
            {usersLoading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-white/50">
                  Loading users...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-white/50">
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
                    <UserName name={user.display_name} country={user.country} />
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
                  <td className="py-2 px-4 text-center">
                    {(() => {
                      const s = predictionStatus.get(user.id);
                      const done = s?.group ?? 0;
                      const isComplete = done === groupMatchCount && groupMatchCount > 0;
                      return (
                        <span className={`text-xs font-medium ${isComplete ? "text-emerald-400" : "text-white/50"}`}>
                          {done}/{groupMatchCount}
                          {isComplete && " ✓"}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="py-2 px-4 text-center">
                    {(() => {
                      const s = predictionStatus.get(user.id);
                      const done = s?.knockout ?? 0;
                      const isComplete = done === knockoutMatchCount && knockoutMatchCount > 0;
                      return (
                        <span className={`text-xs font-medium ${isComplete ? "text-emerald-400" : "text-white/50"}`}>
                          {done}/{knockoutMatchCount}
                          {isComplete && " ✓"}
                        </span>
                      );
                    })()}
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
  );
}
