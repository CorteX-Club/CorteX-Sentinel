/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  distDir: 'out',
  reactStrictMode: true,
  swcMinify: true,
}

module.exports = nextConfig 