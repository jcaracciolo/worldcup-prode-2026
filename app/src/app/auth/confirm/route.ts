import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { redirectToPath } from "@/lib/auth-redirect";

/**
 * Email-link confirmation using the token_hash + verifyOtp flow.
 *
 * Unlike the PKCE `?code=` exchange (which needs a code verifier stored in the
 * browser that requested the email — so it breaks when the link is opened on a
 * different device), verifyOtp works from any browser/device. The recovery /
 * confirmation email template must link here:
 *
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  // Only allow relative redirects to avoid open-redirect abuse.
  const safeNext = next.startsWith("/") ? next : "/";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return redirectToPath(request, safeNext);
    }
    console.error("[Auth] OTP verification failed:", error.message);
  }

  return redirectToPath(request, "/login?error=auth_callback");
}
