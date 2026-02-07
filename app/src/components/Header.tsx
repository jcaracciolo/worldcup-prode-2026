"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useMatches } from "@/contexts/MatchContext";
import { useUser } from "@/contexts/UserContext";

export default function Header() {
  const router = useRouter();
  const supabase = createClient();
  const { isSimulated } = useMatches();
  const { user } = useUser();

  // Defer simulation banner to avoid hydration mismatch
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMounted(true), []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setMenuOpen(false);
    router.refresh();
  };

  return (
    <>
      {/* Simulation Banner - only show after client hydration */}
      {mounted && isSimulated && (
        <div className="bg-amber-500 text-black text-center py-1.5 text-xs sm:text-sm font-medium px-4">
          🧪 Simulation Mode Active — Match data is not real
        </div>
      )}
      <header className="bg-[#0a3d36]/80 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 sm:gap-3 group">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20 group-hover:shadow-green-500/40 transition-all">
              <span className="text-lg sm:text-xl">⚽</span>
            </div>
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-bold text-white tracking-tight">
                WorldCupProde
              </span>
              <span className="text-[9px] sm:text-[10px] text-emerald-400 font-medium tracking-wider uppercase">
                FIFA 2026
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-2">
            <Link
              href="/fixtures"
              className="px-4 py-2 text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            >
              Fixtures
            </Link>
            <Link
              href="/rules"
              className="px-4 py-2 text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            >
              Rules
            </Link>
            {user ? (
              <>
                <Link
                  href="/predictions"
                  className="px-4 py-2 text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                >
                  Predictions
                </Link>
                <Link
                  href="/settings"
                  className="px-4 py-2 text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                >
                  Settings
                </Link>
                {user.is_admin && (
                  <Link
                    href="/admin"
                    className="px-4 py-2 text-sm font-medium bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 rounded-lg transition-all"
                  >
                    Admin
                  </Link>
                )}
                <Link
                  href={`/user/${user.id}`}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-full transition-all"
                >
                  <div className="w-6 h-6 bg-gradient-to-br from-emerald-400 to-green-600 rounded-full flex items-center justify-center text-xs font-bold">
                    {user.display_name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-emerald-100 font-medium">
                    {user.display_name}
                  </span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-sm font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded-lg transition-all"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold rounded-lg hover:from-emerald-400 hover:to-green-500 transition-all shadow-lg shadow-green-500/20 hover:shadow-green-500/40"
              >
                Login
              </Link>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {menuOpen && (
          <nav className="md:hidden border-t border-white/10 py-2 px-4 space-y-1">
            <Link
              href="/fixtures"
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-2.5 text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            >
              Fixtures
            </Link>
            <Link
              href="/rules"
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-2.5 text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            >
              Rules
            </Link>
            {user ? (
              <>
                <Link
                  href="/predictions"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2.5 text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                >
                  Predictions
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2.5 text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                >
                  Settings
                </Link>
                {user.is_admin && (
                  <Link
                    href="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2.5 text-sm font-medium bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 rounded-lg transition-all"
                  >
                    Admin
                  </Link>
                )}
                <Link
                  href={`/user/${user.id}`}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-lg transition-all"
                >
                  <div className="w-6 h-6 bg-gradient-to-br from-emerald-400 to-green-600 rounded-full flex items-center justify-center text-xs font-bold">
                    {user.display_name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-emerald-100 font-medium">
                    {user.display_name}
                  </span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2.5 text-sm font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded-lg transition-all"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold rounded-lg text-center hover:from-emerald-400 hover:to-green-500 transition-all"
              >
                Login
              </Link>
            )}
          </nav>
        )}
      </header>
    </>
  );
}
