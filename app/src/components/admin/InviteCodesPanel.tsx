"use client";

import { useState, useEffect } from "react";
import { useDatabaseService } from "@/contexts/DatabaseContext";
import { useUser } from "@/contexts/UserContext";
import { InviteCodeWithUsedBy } from "@/lib/services/database-types";
import { format } from "date-fns";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

interface InviteCodesPanelProps {
  selectedCompetitionId: string | null;
  competitionName: string | undefined;
}

export default function InviteCodesPanel({
  selectedCompetitionId,
  competitionName,
}: InviteCodesPanelProps) {
  const db = useDatabaseService();
  const { user: profile } = useUser();

  const [inviteCodes, setInviteCodes] = useState<InviteCodeWithUsedBy[]>([]);
  const [codesLoading, setCodesLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

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

  return (
    <section className="glass-card p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold text-white">Invite Codes</h2>
          {selectedCompetitionId && competitionName && (
            <p className="text-sm text-white/50">For: {competitionName}</p>
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
                <th className="text-left py-2 px-4 text-white/60">Created</th>
                <th className="text-left py-2 px-4 text-white/60">Used By</th>
                <th className="text-left py-2 px-4 text-white/60">Status</th>
                <th className="text-left py-2 px-4 text-white/60">Actions</th>
              </tr>
            </thead>
            <tbody>
              {codesLoading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-white/50">
                    Loading invite codes...
                  </td>
                </tr>
              ) : inviteCodes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-white/50">
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
                          {copiedCode === code.code ? "Copied!" : "Copy Link"}
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
  );
}
