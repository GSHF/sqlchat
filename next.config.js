/** @type {import('next').NextConfig} */
module.exports = {
  // Prevent TypeScript errors.
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    outputFileTracingRoot: process.cwd(),
    outputStandalone: false,
  },
};
