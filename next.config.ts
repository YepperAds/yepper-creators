import path from 'path';

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config: { resolve: { alias: Record<string, string> } }) => {
    config.resolve.alias['@'] = path.resolve(process.cwd());
    return config;
  },
};

export default nextConfig;
