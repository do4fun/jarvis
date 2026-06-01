import { withAvatarkit } from '@spatialwalk/avatarkit/next'

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // @spatialwalk packages sont browser-only (WASM + WebGL).
      const prev    = config.externals
      const prevArr = Array.isArray(prev) ? prev : prev ? [prev] : []
      config.externals = [...prevArr, '@spatialwalk/avatarkit', '@spatialwalk/avatarkit-rtc']
    } else {
      // avatarkit-rtc embarque Agora — on n'utilise que LiveKit.
      config.resolve.alias = {
        ...config.resolve.alias,
        'agora-rtc-sdk-ng': false,
      }
    }
    return config
  },
}

export default withAvatarkit(nextConfig)
