const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname);
    return config;
  },
  async rewrites() {
    return [
      {
        source: '/api/auth/google/callback',
        destination: '/auth/google/callback',
      },
      {
        source: '/wp-json/indexinstantly/v1/index',
        destination: '/v1/index',
      },
      {
        source: '/wp-json/indexinstantly/v1/batch/:id',
        destination: '/v1/batch/:id',
      },
    ];
  },
};

module.exports = nextConfig;
