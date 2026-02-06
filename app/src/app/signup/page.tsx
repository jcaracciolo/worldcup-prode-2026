"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get("code") || "";

  const [inviteCode, setInviteCode] = useState(codeFromUrl);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [codeValid, setCodeValid] = useState<boolean | null>(null);

  useEffect(() => {
    setInviteCode(codeFromUrl);
  }, [codeFromUrl]);

  useEffect(() => {
    const checkCode = async () => {
      if (inviteCode.length < 6) {
        setCodeValid(null);
        return;
      }

      const supabase = createClient();
      const { data } = await supabase
        .from("invite_codes")
        .select("id")
        .eq("code", inviteCode)
        .is("used_by", null)
        .single();

      setCodeValid(!!data);
    };

    checkCode();
  }, [inviteCode]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!codeValid) {
      setError("Invalid or already used invite code");
      setLoading(false);
      return;
    }

    const supabase = createClient();

    // Sign up the user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (!authData.user) {
      setError("Failed to create account");
      setLoading(false);
      return;
    }

    // Mark invite code as used via API (needs service role)
    try {
      await fetch("/api/auth/use-invite-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: inviteCode,
          userId: authData.user.id,
        }),
      });
    } catch (codeError) {
      console.error("Failed to mark invite code as used:", codeError);
    }

    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-card p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-green-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-green-500/30">
            <span className="text-3xl">⚽</span>
          </div>
          <h1 className="text-2xl font-bold mt-4 text-white">
            Join WorldCupProde
          </h1>
          <p className="text-white/50 mt-2">Create your account to start predicting</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-5">
          {error && (
            <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="inviteCode"
              className="block text-sm font-medium text-white/70 mb-2"
            >
              Invite Code
            </label>
            <div className="relative">
              <input
                type="text"
                id="inviteCode"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className={`w-full px-4 py-3 bg-white/10 border rounded-xl text-white placeholder-white/40 focus:ring-2 focus:ring-emerald-500 transition-all ${
                  codeValid === true
                    ? "border-emerald-500 bg-emerald-500/10"
                    : codeValid === false
                      ? "border-red-500 bg-red-500/10"
                      : "border-white/20"
                }`}
                placeholder="Enter your invite code"
                required
              />
              {codeValid !== null && (
                <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-lg ${codeValid ? "text-emerald-400" : "text-red-400"}`}>
                  {codeValid ? "✓" : "✗"}
                </span>
              )}
            </div>
            {codeValid === false && (
              <p className="text-red-400 text-xs mt-2">
                Invalid or already used code
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="displayName"
              className="block text-sm font-medium text-white/70 mb-2"
            >
              Display Name
            </label>
            <input
              type="text"
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
              placeholder="How others will see you"
              required
            />
          </div>

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

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-white/70 mb-2"
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !codeValid}
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold rounded-xl hover:from-emerald-400 hover:to-green-500 transition-all shadow-lg shadow-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating account...
              </span>
            ) : "Create Account"}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-white/10 text-center">
          <p className="text-white/50">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>

        <Link
          href="/"
          className="block text-center mt-4 text-white/40 hover:text-white/60 text-sm transition-colors"
        >
          ← Back to home
        </Link>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-white/60">Loading...</div>
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
