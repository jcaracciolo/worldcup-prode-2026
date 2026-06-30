"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDatabase } from "@/contexts/DatabaseContext";
import { useMatches } from "@/contexts/MatchContext";
import { useUser } from "@/contexts/UserContext";
import { useSignOut } from "@/hooks/useAuth";
import UserName from "@/components/UserName";

export default function Header() {
  const router = useRouter();
  const { signOut } = useSignOut();
  const { userCompetitions, currentCompetitionId, switchCompetition } =
    useDatabase();
  const { isSimulated } = useMatches();
  const { user, loading: userLoading } = useUser();

  // Defer simulation banner to avoid hydration mismatch
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [competitionDropdownOpen, setCompetitionDropdownOpen] = useState(false);
  useEffect(() => setMounted(true), []);

  const currentCompetition = userCompetitions.find(
    (c) => c.id === currentCompetitionId,
  );

  const handleLogout = async () => {
    await signOut();
    setMenuOpen(false);
    router.refresh();
  };

  const handleCompetitionSwitch = (competitionId: string) => {
    switchCompetition(competitionId);
    setCompetitionDropdownOpen(false);
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
          <div className="flex items-center gap-4">
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

            {/* Competition Switcher - only show if user has multiple competitions */}
            {mounted && user && userCompetitions.length > 1 && (
              <div className="relative hidden sm:block">
                <button
                  onClick={() =>
                    setCompetitionDropdownOpen(!competitionDropdownOpen)
                  }
                  className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-all text-sm"
                >
                  <span className="text-white/90 max-w-[120px] truncate">
                    {currentCompetition?.name || "Select Competition"}
                  </span>
                  <svg
                    className={`w-4 h-4 text-white/70 transition-transform ${competitionDropdownOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {competitionDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-[#0a3d36] border border-white/20 rounded-lg shadow-xl py-1 z-50">
                    {userCompetitions.map((comp) => (
                      <button
                        key={comp.id}
                        onClick={() => handleCompetitionSwitch(comp.id)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-all ${
                          comp.id === currentCompetitionId
                            ? "text-emerald-400 bg-white/5"
                            : "text-white/90"
                        }`}
                      >
                        {comp.name}
                        {comp.id === currentCompetitionId && (
                          <span className="ml-2 text-emerald-400">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-2">
            <Link
              href="/fixtures"
              className="px-4 py-2 text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            >
              Fixtures
            </Link>
            <Link
              href="/stats"
              className="px-4 py-2 text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            >
              Stats
            </Link>
            <Link
              href="/rules"
              className="px-4 py-2 text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            >
              Rules
            </Link>
            {userLoading ? (
              <div className="w-16 h-8" />
            ) : user ? (
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
                    <UserName name={user.display_name} country={user.country} />
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
            className="lg:hidden p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all"
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
          <nav className="lg:hidden border-t border-white/10 py-2 px-4 space-y-1">
            {/* Mobile Competition Switcher */}
            {user && userCompetitions.length > 1 && (
              <div className="px-4 py-2 mb-2 border-b border-white/10">
                <p className="text-xs text-white/50 mb-2">Competition</p>
                <select
                  value={currentCompetitionId || ""}
                  onChange={(e) => handleCompetitionSwitch(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                >
                  {userCompetitions.map((comp) => (
                    <option
                      key={comp.id}
                      value={comp.id}
                      className="bg-[#0a3d36]"
                    >
                      {comp.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Link
              href="/fixtures"
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-2.5 text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            >
              Fixtures
            </Link>
            <Link
              href="/stats"
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-2.5 text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            >
              Stats
            </Link>
            <Link
              href="/rules"
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-2.5 text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            >
              Rules
            </Link>
            {userLoading ? null : user ? (
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
                    <UserName name={user.display_name} country={user.country} />
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
