import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next 16 renamed the `middleware` file convention to `proxy` (same runtime,
// same behavior) — see node_modules/next/dist/docs/.../proxy.md.
//
// CORS for the Chrome extension (spec 5.4). The extension runs on a
// chrome-extension:// origin, so every fetch() it makes is cross-origin and
// subject to CORS. Same-origin requests from the web app itself never carry
// a foreign Origin header and pass through untouched below.
const EXTENSION_ORIGIN = `chrome-extension://${process.env.EXTENSION_ID ?? ""}`;

const CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin");

  // No Origin header, or same origin as the app itself — not a cross-origin
  // request, nothing to enforce.
  if (!origin || origin === request.nextUrl.origin) {
    return NextResponse.next();
  }

  const isAllowedOrigin = origin === EXTENSION_ORIGIN;
  const isPreflight = request.method === "OPTIONS";

  if (!isAllowedOrigin) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  if (isPreflight) {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        ...CORS_HEADERS,
      },
    });
  }

  const response = NextResponse.next();
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
