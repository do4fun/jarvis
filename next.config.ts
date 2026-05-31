import type { NextConfig } from 'next'
import { withAvatarkit } from '@spatialwalk/avatarkit/next'

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // @spatialwalk packages sont browser-only (WASM + WebGL) — exclure du bundle serveur.
      const prev    = config.externals
      const prevArr = Array.isArray(prev) ? prev : prev ? [prev] : []
      config.externals = [...prevArr, '@spatialwalk/avatarkit', '@spatialwalk/avatarkit-rtc']
    } else {
      // avatarkit-rtc embarque Agora comme alternative à LiveKit — on n'utilise que LiveKit.
      config.resolve.alias = {
        ...config.resolve.alias,
        'agora-rtc-sdk-ng': false,
      }
    }
    return config
  },
}

export default withAvatarkit(nextConfig)
