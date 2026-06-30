import { NextResponse, type NextRequest } from "next/server";

/**
 * Build a redirect to a same-app path that stays correct behind reverse proxies
 * (e.g. Azure App Service), where `request.nextUrl.origin` can resolve to an
 * internal container host like `https://cf0eda73ed2a:8080`. We honor the
 * `X-Forwarded-Host` / `X-Forwarded-Proto` headers the proxy sets so the
 * browser is redirected to the public origin instead.
 */
export function redirectToPath(request: NextRequest, path: string): NextResponse {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const base =
    process.env.NODE_ENV !== "development" && forwardedHost
      ? `${forwardedProto ?? "https"}://${forwardedHost}`
      : request.nextUrl.origin;
  return NextResponse.redirect(`${base}${path}`);
}
