/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  // Production optimizations
  poweredByHeader: false,
  reactStrictMode: true,
  swcMinify: true,
  // Environment-specific configurations
  async redirects() {
    return []
  },
  async rewrites() {
    return []
  }
}

export default nextConfig 