import { withAvatarkit } from '@spatialwalk/avatarkit/next'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // @spatialwalk packages sont browser-only (WASM + WebGL).
      const prev    = config.externals
      const prevArr = Array.isArray(prev) ? prev : prev ? [prev] : []
      config.externals = [...prevArr, '@spatialwalk/avatarkit', '@spatialwalk/avatarkit-rtc']
    } else {
      // withAvatarkit patche avatar_core_wasm-*.js mais pas le bundle principal
      // index-*.js qui contient aussi une data-URI 1.27 Mo + import.meta.url.
      // Notre loader couvre tout le dossier dist/ avec enforce:'pre'.
      config.module.rules.push({
        test:    /\.js$/,
        include: resolve(__dirname, 'node_modules/@spatialwalk/avatarkit/dist'),
        enforce: 'pre',
        loader:  resolve(__dirname, 'scripts/wasm-patch-loader.cjs'),
      })

      config.resolve.alias = {
        ...config.resolve.alias,
        'agora-rtc-sdk-ng': false,
      }
    }
    return config
  },
}

export default withAvatarkit(nextConfig)
