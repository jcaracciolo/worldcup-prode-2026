"use client";

import { useState } from "react";
import Link from "next/link";
import { useResetPassword } from "@/hooks/useAuth";

export default function ForgotPasswordPage() {
  const { resetPassword } = useResetPassword();

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;
    const { error: resetError } = await resetPassword(email, redirectTo);

    setLoading(false);

    if (resetError) {
      setError(resetError);
      return;
    }

    // Always show the same confirmation regardless of whether the email exists,
    // to avoid leaking which addresses are registered.
    setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-card p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-green-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-green-500/30">
            <span className="text-3xl">🔑</span>
          </div>
          <h1 className="text-2xl font-bold mt-4 text-white">
            Reset your password
          </h1>
          <p className="text-white/50 mt-2">
            Enter your email and we&apos;ll send you a reset link
          </p>
        </div>

        {sent ? (
          <div className="space-y-5">
            <div className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 px-4 py-3 rounded-xl text-sm">
              If an account exists for{" "}
              <span className="font-semibold">{email}</span>, a password reset
              link is on its way. Check your inbox (and spam folder).
            </div>
            <Link
              href="/login"
              className="block w-full text-center py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold rounded-xl hover:from-emerald-400 hover:to-green-500 transition-all shadow-lg shadow-green-500/30"
            >
              Back to sign in
            </Link>
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
                htmlFor="email"
                className="block text-sm font-medium text-white/70 mb-2"
              >
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                placeholder="you@example.com"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold rounded-xl hover:from-emerald-400 hover:to-green-500 transition-all shadow-lg shadow-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
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
                  Sending...
                </span>
              ) : (
                "Send reset link"
              )}
            </button>
          </form>
        )}

        <Link
          href="/login"
          className="block text-center mt-6 text-white/40 hover:text-white/60 text-sm transition-colors"
        >
          ← Back to sign in
        </Link>
      </div>
    </div>
  );
}
