import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { redirectToPath } from "@/lib/auth-redirect";

/**
 * Auth callback for the PKCE flow (OAuth, magic links, etc.).
 *
 * Note: password recovery uses the token_hash + verifyOtp flow at /auth/confirm
 * instead, because the PKCE code verifier is only available in the same browser
 * that initiated the request — recovery emails are often opened elsewhere.
 *
 * Supabase appends a `?code=...` to the configured redirect URL. We exchange
 * that code for a session and forward the user to `next`. If the exchange fails
 * we send them to login with an error flag.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  // Only allow relative redirects to avoid open-redirect abuse.
  const safeNext = next.startsWith("/") ? next : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return redirectToPath(request, safeNext);
    }
    console.error("[Auth] Code exchange failed:", error.message);
  }

  return redirectToPath(request, "/login?error=auth_callback");
}
