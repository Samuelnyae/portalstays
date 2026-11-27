import type { NextConfig } from "next";

/**
 * Self-contained fullstack app: the React portal is the "/" page and the
 * wellbeing API lives in the Next.js API routes (src/app/api). Data is stored
 * in PostgreSQL, which is started automatically with the app
 * (src/instrumentation.ts -> src/lib/server/pg.ts).
 */
const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // These packages resolve binaries/platform code dynamically at runtime and
  // must not be bundled; they are loaded as-is from node_modules.
  serverExternalPackages: [
    "embedded-postgres",
    "@embedded-postgres/linux-x64",
    "@embedded-postgres/linux-arm64",
    "pg",
    "bcryptjs",
  ],
  // Guarantee the embedded-postgres platform binaries survive output tracing
  // in standalone production builds (their imports are dynamic templates).
  outputFileTracingIncludes: {
    "/**": [
      "./node_modules/embedded-postgres/**",
      "./node_modules/@embedded-postgres/**",
    ],
  },
};

export default nextConfig;
