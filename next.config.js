/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    outputFileTracingRoot: undefined,
    optimizeCss: false,
    optimizeServerReact: false,
    isrMemoryCacheSize: 0,
    forceSwcTransforms: true,
    swcTraceProfiling: false,
  },
  images: {
    unoptimized: true,
  },
  // Prevent TypeScript errors.
  typescript: {
    ignoreBuildErrors: true
  },
  // Prevent ESLint errors.
  eslint: {
    ignoreDuringBuilds: true
  }
};

module.exports = nextConfig;