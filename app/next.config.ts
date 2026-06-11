import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    staleTimes: {
      // Cache dynamic RSC responses client-side for 30s so repeat
      // navigations (back → re-click) are instant instead of re-fetching.
      dynamic: 30,
    },
  },
};

export default nextConfig;
