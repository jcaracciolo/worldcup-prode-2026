"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { useDatabase } from "@/contexts/DatabaseContext";
import { useChangePassword, useInviteCodes } from "@/hooks/useAuth";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function SettingsPage() {
  const router = useRouter();
  const { changePassword } = useChangePassword();
  const { checkInviteCode } = useInviteCodes();
  const { userCompetitions, refreshCompetitions } = useDatabase();
  const { user: profile, loading: userLoading, updateProfile } = useUser();

  const [displayName, setDisplayName] = useState("");
  const [_currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  // Join competition state
  const [inviteLink, setInviteLink] = useState("");
  const [joiningCompetition, setJoiningCompetition] = useState(false);

  useEffect(() => {
    if (!userLoading && !profile) {
      router.push("/login?redirect=/settings");
      return;
    }
    if (profile) {
      // Use queueMicrotask to avoid sync setState warning
      queueMicrotask(() => {
        setDisplayName(profile.display_name || "");
      });
    }
  }, [profile, userLoading, router]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: "", text: "" });

    if (!profile) return;

    const result = await updateProfile({ display_name: displayName });

    if (result.success) {
      setMessage({ type: "success", text: "Profile updated!" });
    } else {
      setMessage({
        type: "error",
        text: result.error || "Failed to update profile",
      });
    }

    setSaving(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: "", text: "" });

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match" });
      setSaving(false);
      return;
    }

    if (newPassword.length < 6) {
      setMessage({
        type: "error",
        text: "Password must be at least 6 characters",
      });
      setSaving(false);
      return;
    }

    const { error } = await changePassword(newPassword);

    if (error) {
      setMessage({ type: "error", text: error });
    } else {
      setMessage({ type: "success", text: "Password changed!" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }

    setSaving(false);
  };

  const handleJoinCompetition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setJoiningCompetition(true);
    setMessage({ type: "", text: "" });

    try {
      // Parse the invite link to extract code and competition
      let code = "";
      let competitionId = "";

      try {
        const url = new URL(inviteLink);
        code = url.searchParams.get("code") || "";
        competitionId = url.searchParams.get("competition") || "";
      } catch {
        // If not a valid URL, assume it's just the code
        code = inviteLink.trim().toUpperCase();
      }

      if (!code) {
        setMessage({ type: "error", text: "Invalid invite link or code" });
        setJoiningCompetition(false);
        return;
      }

      // Verify the invite code is valid
      const { data: codeData } = await checkInviteCode(code);
      if (!codeData) {
        setMessage({
          type: "error",
          text: "Invalid or already used invite code",
        });
        setJoiningCompetition(false);
        return;
      }

      // Use the competition from the code if not in URL
      const targetCompetitionId = competitionId || codeData.competition_id;

      // Check if already a member
      const alreadyMember = userCompetitions.some(
        (c) => c.id === targetCompetitionId,
      );
      if (alreadyMember) {
        setMessage({
          type: "error",
          text: "You are already a member of this competition",
        });
        setJoiningCompetition(false);
        return;
      }

      // Call the API to use the invite code and join the competition
      const response = await fetch("/api/auth/use-invite-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          userId: profile.id,
          competitionId: targetCompetitionId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        setMessage({
          type: "error",
          text: error.error || "Failed to join competition",
        });
        setJoiningCompetition(false);
        return;
      }

      // Refresh competitions list
      await refreshCompetitions();
      setInviteLink("");
      setMessage({ type: "success", text: "Successfully joined competition!" });
    } catch (error) {
      console.error("Error joining competition:", error);
      setMessage({ type: "error", text: "Failed to join competition" });
    }

    setJoiningCompetition(false);
  };

  if (userLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6 text-white">Settings</h1>

        {message.text && (
          <div
            className={`mb-6 px-4 py-3 rounded-lg ${
              message.type === "error"
                ? "bg-red-500/20 border border-red-500/30 text-red-300"
                : "bg-green-500/20 border border-green-500/30 text-green-300"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="max-w-lg space-y-6">
          {/* Profile Settings */}
          <section className="glass-card p-8">
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-white/70 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={profile?.email || ""}
                  disabled
                  className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white/50"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-white/70 mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </form>
          </section>

          {/* Password Settings */}
          <section className="glass-card p-8">
            <form onSubmit={handleChangePassword} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-white/70 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  minLength={6}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-white/70 mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  minLength={6}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {saving ? "Changing..." : "Change Password"}
              </button>
            </form>
          </section>

          {/* Join Competition */}
          <section className="glass-card p-8">
            <h2 className="text-lg font-semibold text-white mb-4">
              Join Another Competition
            </h2>
            <p className="text-white/60 text-sm mb-4">
              Paste an invite link or code to join another competition.
            </p>

            {userCompetitions.length > 0 && (
              <div className="mb-4">
                <p className="text-white/50 text-sm mb-2">Your competitions:</p>
                <ul className="space-y-1">
                  {userCompetitions.map((comp) => (
                    <li key={comp.id} className="text-white/70 text-sm">
                      • {comp.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <form onSubmit={handleJoinCompetition} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-white/70 mb-2">
                  Invite Link or Code
                </label>
                <input
                  type="text"
                  value={inviteLink}
                  onChange={(e) => setInviteLink(e.target.value)}
                  placeholder="https://...?code=ABC123&competition=... or just ABC123"
                  className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={joiningCompetition || !inviteLink.trim()}
                className="px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
              >
                {joiningCompetition ? "Joining..." : "Join Competition"}
              </button>
            </form>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/10 mt-auto">
        <div className="container mx-auto px-4 py-6 text-center">
          <p className="text-white/40 text-sm">
            WorldCupProde - FIFA World Cup 2026 Predictions
          </p>
        </div>
      </footer>
    </div>
  );
}
