'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types/database'

interface HeaderProps {
  user: Profile | null
}

export default function Header({ user }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.refresh()
  }

  return (
    <header className="bg-gradient-to-r from-green-800 to-green-600 text-white shadow-lg">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">⚽</span>
          <span className="text-xl font-bold">WorldCupProde</span>
        </Link>

        <nav className="flex items-center gap-4">
          {user ? (
            <>
              <span className="text-green-100 hidden sm:inline">
                {user.display_name}
              </span>
              <Link
                href="/predictions"
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
              >
                Predictions
              </Link>
              <Link
                href="/settings"
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
              >
                Settings
              </Link>
              {user.is_admin && (
                <Link
                  href="/admin"
                  className="px-4 py-2 bg-yellow-500/80 hover:bg-yellow-500 rounded-lg transition"
                >
                  Admin
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500/80 hover:bg-red-500 rounded-lg transition"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="px-4 py-2 bg-white text-green-800 font-semibold rounded-lg hover:bg-green-100 transition"
            >
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
