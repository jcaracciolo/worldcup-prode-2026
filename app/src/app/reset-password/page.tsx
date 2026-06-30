"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useChangePassword } from "@/hooks/useAuth";
import { useDatabaseService } from "@/contexts/DatabaseContext";

export default function ResetPasswordPage() {
  const router = useRouter();
  const db = useDatabaseService();
  const { changePassword } = useChangePassword();

  const [checking, setChecking] = useState(true);
  const [validSession, setValidSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  // The /auth/callback route exchanges the recovery code for a session before
  // redirecting here, so a valid recovery session should already exist. Verify
  // it so we can show a friendly "link expired" message otherwise.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await db.auth.getUser();
      if (!cancelled) {
        setValidSession(!!data);
        setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setSaving(true);
    const { error: updateError } = await changePassword(password);
    setSaving(false);

    if (updateError) {
      setError(updateError);
      return;
    }
    setDone(true);
  };

  if (checking) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-card p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-green-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-green-500/30">
            <span className="text-3xl">🔒</span>
          </div>
          <h1 className="text-2xl font-bold mt-4 text-white">
            Set a new password
          </h1>
          <p className="text-white/50 mt-2">Choose a strong new password</p>
        </div>

        {!validSession ? (
          <div className="space-y-5">
            <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm">
              This reset link is invalid or has expired. Request a new one to
              continue.
            </div>
            <Link
              href="/forgot-password"
              className="block w-full text-center py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold rounded-xl hover:from-emerald-400 hover:to-green-500 transition-all shadow-lg shadow-green-500/30"
            >
              Request a new link
            </Link>
          </div>
        ) : done ? (
          <div className="space-y-5">
            <div className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 px-4 py-3 rounded-xl text-sm">
              Your password has been updated. You&apos;re all set!
            </div>
            <button
              onClick={() => {
                router.push("/");
                router.refresh();
              }}
              className="block w-full text-center py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold rounded-xl hover:from-emerald-400 hover:to-green-500 transition-all shadow-lg shadow-green-500/30"
            >
              Continue
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-white/70 mb-2"
              >
                New password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            <div>
              <label
                htmlFor="confirm"
                className="block text-sm font-medium text-white/70 mb-2"
              >
                Confirm new password
              </label>
              <input
                type="password"
                id="confirm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold rounded-xl hover:from-emerald-400 hover:to-green-500 transition-all shadow-lg shadow-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Saving...
                </span>
              ) : (
                "Update password"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
