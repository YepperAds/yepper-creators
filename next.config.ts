import path from 'path';

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https' as const, hostname: 'images.unsplash.com' },
    ],
  },
  experimental: {
    cpus: 1,
  },
  turbopack: {},
  webpack: (config: { resolve: { alias: Record<string, string> } }) => {
    config.resolve.alias['@'] = path.resolve(process.cwd());
    return config;
  },
};

export default nextConfig;
