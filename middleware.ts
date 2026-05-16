import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const CANONICAL_HOST = "goksorry.com";
const LEGACY_HOSTS = new Set(["www.goksorry.com"]);
const CHAT_CONNECT_SOURCES = ["https://*.workers.dev", "wss://*.workers.dev"];
const GOOGLE_ANALYTICS_CONNECT_SOURCES = [
  "https://www.google-analytics.com",
  "https://region1.google-analytics.com"
];

const buildCsp = (nonce: string): string => {
  const isDev = process.env.NODE_ENV !== "production";
  const scriptDirectives = isDev
    ? "'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com"
    : `'self' 'nonce-${nonce}' 'strict-dynamic' https://www.googletagmanager.com`;
  const connectSources = [
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://accounts.google.com",
    "https://www.googleapis.com",
    ...GOOGLE_ANALYTICS_CONNECT_SOURCES,
    ...CHAT_CONNECT_SOURCES
  ].join(" ");

  return [
    "default-src 'self'",
    `script-src ${scriptDirectives}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    `connect-src ${connectSources}`,
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'"
  ].join("; ");
};

export function middleware(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const requestHost = (forwardedHost ?? request.nextUrl.host).toLowerCase();
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const isHttps = request.nextUrl.protocol === "https:" || forwardedProto === "https";

  if (LEGACY_HOSTS.has(requestHost)) {
    const canonicalUrl = request.nextUrl.clone();
    canonicalUrl.hostname = CANONICAL_HOST;
    return NextResponse.redirect(canonicalUrl, 308);
  }

  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Cross-Origin-Resource-Policy", "same-site");

  if (isHttps) {
    response.headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"]
};
