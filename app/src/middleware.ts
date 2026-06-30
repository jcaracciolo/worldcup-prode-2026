import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/matches (public match data — polled frequently and gates page
     *   load; it self-caches and needs no auth, so skip the per-request
     *   supabase.auth.getUser() network round-trip the middleware would add)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|api/matches|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
