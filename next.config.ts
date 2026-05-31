import type { NextConfig } from 'next'
import path from 'path'
import fs from 'fs'

// ── Auto-copie le WASM depuis node_modules vers public/wasm/ ─────────────────
// Permet de gitignorer le binaire et de le régénérer automatiquement
// après npm install (utile quand le package change de version).
function ensureWasm() {
  const distDir      = path.resolve('./node_modules/@spatialwalk/avatarkit/dist')
  const publicWasmDir = path.resolve('./public/wasm')
  try {
    const files = fs.readdirSync(distDir)
    for (const file of files) {
      if (file.startsWith('avatar_core_wasm') && file.endsWith('.wasm')) {
        const dest = path.join(publicWasmDir, file)
        if (!fs.existsSync(dest)) {
          fs.mkdirSync(publicWasmDir, { recursive: true })
          fs.copyFileSync(path.join(distDir, file), dest)
          console.log(`[avatarkit] copied ${file} → public/wasm/`)
        }
      }
    }
  } catch (e) {
    console.warn('[avatarkit] Failed to copy WASM:', (e as Error).message)
  }
}

ensureWasm()

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // @spatialwalk packages sont browser-only (WASM + WebGL).
      // Les exclure du bundle serveur évite que webpack essaie de compiler
      // le WASM embarqué en data-URL ("generator.filename invalid for asset/inline").
      const prev    = config.externals
      const prevArr = Array.isArray(prev) ? prev : prev ? [prev] : []
      config.externals = [...prevArr, '@spatialwalk/avatarkit', '@spatialwalk/avatarkit-rtc']
    } else {
      // Next.js set module.generator.asset.filename which is not valid for asset/inline
      // modules (data URIs). Move it to asset/resource where filename is supported.
      if (config.module.generator?.asset?.filename) {
        const filename = config.module.generator.asset.filename
        delete config.module.generator.asset.filename
        config.module.generator['asset/resource'] = {
          ...config.module.generator['asset/resource'],
          filename,
        }
      }

      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
        layers: true,
      }

      // wasm-patch-loader : couvre TOUT le dossier dist/ (avatar_core_wasm-*.js
      // ET index-*.js qui embarquent tous deux des data-URI import.meta.url).
      // enforce:'pre' garantit que le patch s'applique AVANT SWC/Babel.
      config.module.rules.push({
        test:    /\.js$/,
        include: path.resolve('./node_modules/@spatialwalk/avatarkit/dist'),
        enforce: 'pre',
        loader:  path.resolve('./scripts/wasm-patch-loader.cjs'),
      })

      // avatarkit-rtc embarque Agora — on n'utilise que LiveKit.
      config.resolve.alias = {
        ...config.resolve.alias,
        'agora-rtc-sdk-ng': false,
      }
    }

    return config
  },
}

export default nextConfig
