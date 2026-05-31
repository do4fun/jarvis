/**
 * Webpack loader for @spatialwalk/avatarkit dist files.
 *
 * Patches two patterns that cause webpack / browser errors:
 *
 * Pattern A — Emscripten scriptDirectory (avatar_core_wasm-*.js, line ~8):
 *   `var _scriptName = import.meta.url`
 *   → Replaced so scriptDirectory resolves to <origin>/wasm/ instead of file://
 *
 * Pattern B — data-URI WASM fallback (both avatar_core_wasm-*.js and index-*.js):
 *   `new URL("data:application/wasm;base64,[~1MB]", import.meta.url).href`
 *   Two forms:
 *     B1: starts a line with `return new URL(...)` (WASM wrapper file)
 *     B2: mid-line ternary `... : new URL(...).href` (main index bundle)
 *   → Replaced with a real URL pointing to public/wasm/<filename>
 *
 * The WASM filename is discovered dynamically from node_modules so this loader
 * survives package version bumps without manual hash updates.
 *
 * Pre-requisite: .wasm binary must live at public/wasm/<filename>.
 * next.config.ts auto-copies it via ensureWasm() on startup.
 */
const fs   = require('fs')
const path = require('path')

const sdkDist = path.resolve(__dirname, '../node_modules/@spatialwalk/avatarkit/dist')
const wasmFilename = fs.readdirSync(sdkDist).find(
  f => f.startsWith('avatar_core_wasm') && f.endsWith('.wasm'),
) ?? 'avatar_core_wasm.wasm'

const wasmPublicUrl =
  `(typeof window !== "undefined" ? window.location.origin : "http://localhost:3000") + "/wasm/${wasmFilename}"`

module.exports = function wasmPatchLoader(source) {
  const lines = source.split('\n')

  return lines.map(line => {

    // ── Pattern A : scriptDirectory fix ─────────────────────────────────────
    if (line.includes('var _scriptName = import.meta.url')) {
      return line.replace(
        'var _scriptName = import.meta.url',
        'var _scriptName = ' +
          '(typeof window !== "undefined" ? window.location.origin : "http://localhost:3000") + ' +
          '"/wasm/placeholder.js"',
      )
    }

    // ── Pattern B1 : `return new URL("data:application/wasm;base64,…")` ────
    // From the WASM wrapper file — the line STARTS with `return new URL(…`
    if (line.trimStart().startsWith('return new URL("data:application/wasm;base64,')) {
      const indent = line.length - line.trimStart().length
      return ' '.repeat(indent) + `return locateFile("${wasmFilename}");`
    }

    // ── Pattern B2 : inline ternary with data-URI  ───────────────────────────
    // From index-*.js — the line CONTAINS `new URL("data:application/wasm;base64,`
    // mid-expression (e.g. `const wasmUrl = … : new URL("data:…", import.meta.url).href`)
    if (
      line.includes('new URL("data:application/wasm;base64,') &&
      line.includes('import.meta.url')
    ) {
      const prefix    = 'new URL("data:application/wasm;base64,'
      const suffix    = '", import.meta.url).href'
      const start     = line.indexOf(prefix)
      const end       = line.lastIndexOf(suffix)
      if (start !== -1 && end !== -1) {
        return line.slice(0, start) + wasmPublicUrl + line.slice(end + suffix.length)
      }
    }

    return line
  }).join('\n')
}
