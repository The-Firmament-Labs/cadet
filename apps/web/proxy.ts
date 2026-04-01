import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = new Set([
  "/",
  "/sign-in",
  "/sign-up",
  "/desktop-callback",
  "/docs",
  "/api/health",
  "/api/auth/register",
  "/api/auth/login",
  "/api/auth/logout",
]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  // Allow static assets and API routes that don't need auth
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/visuals/")) return true;
  if (pathname.startsWith("/api/cron/")) return true;
  if (pathname.startsWith("/api/agents/")) return true;
  if (pathname.startsWith("/api/jobs/")) return true;
  if (pathname.startsWith("/api/github/")) return true;
  if (pathname.startsWith("/api/slack/")) return true;
  if (pathname.startsWith("/api/auth/vercel/")) return true;
  if (pathname.startsWith("/api/auth/desktop-token")) return true;
  if (pathname.startsWith("/api/queues/")) return true;
  if (pathname.startsWith("/api/workflows/")) return true;
  return false;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Check for session cookie on dashboard routes
  const session = request.cookies.get("cadet_session");
  if (!session?.value) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
