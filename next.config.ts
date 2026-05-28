import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // @spatialwalk packages sont browser-only (WASM + WebGL).
      // Les exclure du bundle serveur évite que webpack essaie de compiler
      // le WASM embarqué en data-URL, ce qui échoue avec
      // "generator.filename invalid for asset/inline".
      // Avec ssr: false sur AvatarKitSection, ces modules ne sont jamais
      // exécutés côté serveur.
      const prev = config.externals
      const prevArr = Array.isArray(prev) ? prev : prev ? [prev] : []
      config.externals = [
        ...prevArr,
        '@spatialwalk/avatarkit',
        '@spatialwalk/avatarkit-rtc',
      ]
    } else {
      // Bundle client
      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
        layers: true,
      }

      // Le wrapper Emscripten de AvatarKit utilise import.meta.url pour
      // construire scriptDirectory, ce qui en mode dev webpack donne un
      // chemin file:// que le browser refuse de charger.
      // wasm-patch-loader :
      //   1. Remplace _scriptName par window.location.origin+"/wasm/…"
      //      → locateFile() retourne <origin>/wasm/avatar_core_wasm-*.wasm
      //      → le browser fetch depuis Next.js public/wasm/ via HTTP ✓
      //   2. Remplace la ligne data-URI de 1.27 Mo par un simple appel
      //      locateFile(), empêchant webpack de parser l'énorme payload.
      config.module.rules.unshift({
        test: /avatar_core_wasm-[^.]+\.js$/,
        include: path.resolve('./node_modules/@spatialwalk/avatarkit'),
        loader: path.resolve('./scripts/wasm-patch-loader.cjs'),
      })

      // avatarkit-rtc embarque Agora comme alternative à LiveKit.
      // Nous n'utilisons que LiveKitProvider → stubber la dépendance inutile.
      config.resolve.alias = {
        ...config.resolve.alias,
        'agora-rtc-sdk-ng': false,
      }
    }

    return config
  },
}

export default nextConfig
