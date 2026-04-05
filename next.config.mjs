/** @type {import('next').NextConfig} */
// WhatsApp automation uses external HTTP service - no native dependencies needed
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
