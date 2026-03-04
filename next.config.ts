import type { NextConfig } from "next";

// LAYER 7 — WASM bundler config:
// Turbopack (Next.js 16 default) handles WASM natively.
// Empty `turbopack` key silences the config-mismatch warning.
// Webpack fallback kept for CI environments.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {},
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    return config;
  },
};

export default nextConfig;
