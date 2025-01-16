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
  output: 'standalone',
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
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        dns: false,
        fs: false,
        net: false,
        tls: false,
        pg: false,
      };
    }
    return config;
  }
}

module.exports = nextConfig;