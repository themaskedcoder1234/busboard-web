/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverActions: { bodySizeLimit: '50mb' } },
  images: { domains: ['live.staticflickr.com'] }
}
module.exports = nextConfig
