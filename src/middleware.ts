import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

export async function middleware(request: NextRequest) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    return new NextResponse("Server misconfigured", { status: 500 });
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (await verifySessionToken(secret, token)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  /**
   * Everything is gated except the paths that cannot present a session: `api/webhooks`
   * (Fathom signs its requests instead of logging in), `api/health` (uptime probes),
   * and the login surface itself. Making a route public means adding it here — the
   * default is protected.
   */
  matcher: [
    "/((?!api/webhooks|api/health|api/auth|login|_next/static|_next/image|favicon.ico).*)",
  ],
};
