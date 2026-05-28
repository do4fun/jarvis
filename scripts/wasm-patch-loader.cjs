/**
 * Webpack loader for @spatialwalk/avatarkit Emscripten wrapper.
 *
 * Two problems with the Emscripten-generated file in webpack dev mode:
 *
 * 1. `_scriptName = import.meta.url` resolves to a `file://` source path.
 *    The derived `scriptDirectory` (and hence `locateFile()`) then produces
 *    a `file://` URL for the .wasm file, which the browser rejects.
 *
 * 2. The fallback `return new URL("data:application/wasm;base64,[1.27 MB]",
 *    import.meta.url).href` is a 1.27 MB line that webpack would try to
 *    parse as an asset dependency — causing extremely slow compilation.
 *
 * Fixes:
 * - Patch `_scriptName` so `scriptDirectory` becomes `<origin>/wasm/`.
 *   AvatarKit's own `locateFile` then returns `<origin>/wasm/<filename>`,
 *   which the browser fetches over HTTP from Next.js `public/wasm/`.
 *
 * - Replace the 1.27 MB data-URI line with a short call to `locateFile`,
 *   so webpack never tries to parse or extract the huge base64 payload.
 *
 * Pre-requisite: the .wasm binary must live at public/wasm/<filename>.
 */
module.exports = function wasmPatchLoader(source) {
  const lines = source.split('\n');

  return lines.map(line => {
    // Fix 1: override _scriptName so new URL(".", _scriptName).href
    // becomes `<origin>/wasm/` at runtime instead of a file:// path.
    if (line.includes('var _scriptName = import.meta.url')) {
      return line.replace(
        'var _scriptName = import.meta.url',
        'var _scriptName = ' +
          '(typeof window !== "undefined" ? window.location.origin : "http://localhost:3000") + ' +
          '"/wasm/placeholder.js"'
      );
    }

    // Fix 2: replace the 1.27 MB data-URI return with a short fallback
    // that delegates to the already-patched locateFile().
    if (line.trimStart().startsWith('return new URL("data:application/wasm;base64,')) {
      const indent = line.length - line.trimStart().length;
      return ' '.repeat(indent) + 'return locateFile("avatar_core_wasm-e68766db.wasm");';
    }

    return line;
  }).join('\n');
};
