import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/**
 * Content-Security-Policy.
 *
 * Shipped as Report-Only first (spec §10) because enforcing it blind would
 * break the Google Picker flow before anyone noticed. Promote the header name
 * to `Content-Security-Policy` once reports from a real session come back
 * clean.
 *
 * Notes on the allowances that are here on purpose:
 * - `'unsafe-inline'` in script-src: Next's hydration bootstrap and
 *   next-themes' pre-paint theme script are inline. Removing it requires
 *   nonce plumbing through proxy.ts — tracked in SECURITY-AUDIT.md.
 * - apis.google.com / accounts.google.com: the Drive Picker and Google
 *   Identity Services scripts (components/DriveAttachButton.tsx).
 * - There is deliberately no `'unsafe-eval'`.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://apis.google.com https://accounts.google.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://lh3.googleusercontent.com https://*.googleusercontent.com",
  "font-src 'self' data:",
  "connect-src 'self' https://www.googleapis.com https://accounts.google.com",
  "frame-src https://docs.google.com https://accounts.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "Content-Security-Policy-Report-Only", value: csp },
  // HSTS only in production: sending it from http://localhost would pin the
  // browser to https for localhost and break local development.
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // pdf-parse (via pdfjs-dist) tries to load a worker script at a path that
  // only resolves under Node's own module resolution — bundling it through
  // Turbopack/webpack breaks that path and pdfjs throws "Setting up fake
  // worker failed". Leaving it external avoids the bundler touching it.
  serverExternalPackages: ["pdf-parse"],
  images: {
    remotePatterns: [
      // Google account avatars and Classroom teacher profile photos.
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
