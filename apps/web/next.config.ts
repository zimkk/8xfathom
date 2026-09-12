import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@fathom/core', '@fathom/db', '@fathom/ui', '@fathom/integrations'],
  webpack: (config: any) => {
    // Workspace packages use NodeNext .js extensions; remap to .ts for bundling
    config.resolve = config.resolve ?? {}
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }
    return config
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
}

export default nextConfig
