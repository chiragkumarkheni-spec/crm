import type { NextConfig } from "next";

// Security response headers on every page. These are the "safe" set — they harden
// the app (clickjacking, MIME-sniffing, referrer leakage, base-tag/plugin
// injection, HSTS) without a strict script/style CSP that could white-screen the
// app, so nothing breaks. (A nonce-based full CSP can come later if needed.)
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
