"use client";

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  return (
    <>
      {/* Simulation Banner */}
      {isSimulated && (
        <div className="bg-amber-500 text-black text-center py-1.5 text-sm font-medium">
          🧪 Simulation Mode Active — Match data is not real
        </div>
      )}
      <header className="bg-[#0a3d36]/80 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20 group-hover:shadow-green-500/40 transition-all">
              <span className="text-xl">⚽</span>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-white tracking-tight">
                WorldCupProde
              </span>
              <span className="text-[10px] text-emerald-400 font-medium tracking-wider uppercase">
                FIFA 2026
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-2">
            {/* Fixtures link - visible to everyone */}
            <Link
              href="/fixtures"
              className="px-4 py-2 text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            >
              Fixtures
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
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-full transition-all"
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
        </div>
      </header>
    </>
  );
}
