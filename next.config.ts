import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Agent actions carry base64 evidence photos (up to 3 × ~300 KB, plus before/after pairs for CivicProof).
      bodySizeLimit: '6mb',
    },
  },
  images: {
    // Seed evidence photos come from Unsplash; authority-submitted proof lands
    // on Cloudinary when it is configured, and falls back to inline base64.
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
};

export default nextConfig;
