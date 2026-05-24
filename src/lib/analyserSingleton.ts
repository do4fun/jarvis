/**
 * Module-level singleton for the Web Audio AnalyserNode.
 *
 * Written by useAudio when the AudioContext is created.
 * Read by Avatar.tsx inside useFrame (render loop) for amplitude-based lip-sync.
 *
 * Using a plain object instead of a React ref so it is accessible outside
 * React component trees (e.g., in R3F useFrame callbacks).
 */
export const analyserSingleton: { node: AnalyserNode | null } = { node: null }
