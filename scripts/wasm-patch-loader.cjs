/**
 * Webpack loader for @spatialwalk/avatarkit Emscripten wrapper.
 *
 * Two problems with the Emscripten-generated file in webpack dev mode:
 *
 * 1. `_scriptName = import.meta.url` resolves to a `file://` source path.
 *    The derived `scriptDirectory` (and hence `locateFile()`) then produces
 *    a `file://` URL for the .wasm file, which the browser rejects.
 *
 * 2. The fallback `return new URL("data:application/wasm;base64,[~1MB]", ...)`
 *    is a massive line that webpack tries to parse as an asset dependency,
 *    causing extremely slow compilation.
 *
 * Fixes:
 * - Patch `_scriptName` so `scriptDirectory` becomes `<origin>/wasm/`.
 *   AvatarKit's own `locateFile` then returns `<origin>/wasm/<filename>`,
 *   which the browser fetches over HTTP from Next.js `public/wasm/`.
 *
 * - Replace the data-URI line with a short call to `locateFile`,
 *   using the actual WASM filename discovered dynamically from node_modules
 *   (version-agnostic — survives package updates).
 *
 * Pre-requisite: the .wasm binary must live at public/wasm/<filename>.
 * next.config.ts auto-copies it from node_modules on startup (ensureWasm).
 */
const fs   = require('fs')
const path = require('path')

// Discover the WASM filename from the SDK dist directory at loader load time.
// __dirname = scripts/, so ../node_modules is the project root node_modules.
const sdkDist = path.resolve(__dirname, '../node_modules/@spatialwalk/avatarkit/dist')
const wasmFilename = fs.readdirSync(sdkDist).find(
  f => f.startsWith('avatar_core_wasm') && f.endsWith('.wasm')
) ?? 'avatar_core_wasm.wasm'

module.exports = function wasmPatchLoader(source) {
  const lines = source.split('\n')

  return lines.map(line => {
    // Fix 1: override _scriptName so `new URL(".", _scriptName).href`
    // becomes `<origin>/wasm/` at runtime instead of a file:// path.
    if (line.includes('var _scriptName = import.meta.url')) {
      return line.replace(
        'var _scriptName = import.meta.url',
        'var _scriptName = ' +
          '(typeof window !== "undefined" ? window.location.origin : "http://localhost:3000") + ' +
          '"/wasm/placeholder.js"'
      )
    }

    // Fix 2: replace the ~1MB data-URI return with a short locateFile() call.
    if (line.trimStart().startsWith('return new URL("data:application/wasm;base64,')) {
      const indent = line.length - line.trimStart().length
      return ' '.repeat(indent) + `return locateFile("${wasmFilename}");`
    }

    return line
  }).join('\n')
}
