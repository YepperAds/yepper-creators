import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // images.remotePatterns — add external domains here when needed
  // e.g. for /public/campaigns/ files, no config needed (local files are always allowed)
  typescript: {
    // Temporary: ignore TypeScript build errors to allow incremental fixes.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
