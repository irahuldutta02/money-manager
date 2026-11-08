import { NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Optimistic first gate only: checks that a session cookie EXISTS (no DB call).
// Every API route handler re-validates the session for real.
export function proxy(request) {
  if (getSessionCookie(request)) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  // Signed-out visitors get the public landing page at "/".
  if (pathname === "/landing") return NextResponse.next();
  if (pathname === "/") {
    return NextResponse.rewrite(new URL("/landing", request.url));
  }
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Sign in required" } },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  const url = new URL("/sign-in", request.url);
  url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Everything except: auth endpoints, the sign-in and public legal pages, build assets and
    // PWA/static files (manifest, service worker, icons, robots).
    "/((?!.*\\.(?:png|svg|ico|jpg|jpeg|webp)$|api/auth(?:/|$)|sign-in|privacy(?:/|$)|terms(?:/|$)|_next/static|_next/image|favicon\\.ico|icon|apple-icon|manifest\\.webmanifest|sw\\.js|robots\\.txt).*)",
  ],
};
