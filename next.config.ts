import path from 'path';

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    cpus: 1,
  },
  webpack: (config: { resolve: { alias: Record<string, string> } }) => {
    config.resolve.alias['@'] = path.resolve(process.cwd());
    return config;
  },
};

export default nextConfig;
