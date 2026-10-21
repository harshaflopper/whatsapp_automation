import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page is private and shows live data, so we use plain dynamic rendering
  // rather than Cache Components' prerendered shells.
  cacheComponents: false,
  poweredByHeader: false,
  serverExternalPackages: ["pg"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
