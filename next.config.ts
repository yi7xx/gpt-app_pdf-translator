import type { NextConfig } from 'next'
import { baseURL } from './src/baseUrl'

const nextConfig: NextConfig = {
  assetPrefix: baseURL,
  sassOptions: {},
}

export default nextConfig
