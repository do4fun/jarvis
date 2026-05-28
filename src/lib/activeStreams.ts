// ─────────────────────────────────────────────────────────────────────────────
// activeStreams — Registre partagé des AbortControllers en cours
//
// Ce module est importé à la fois par :
//   - /api/chat/route.ts  : enregistre l'AbortController au démarrage du stream
//   - server.ts           : annule le stream lors d'un barge-in WebSocket
//
// Fonctionne car les deux modules s'exécutent dans le même processus Node.js.
// En mode dev Next.js (hot-reload), la Map peut être réinitialisée — acceptable.
//
// Optimisation latence : l'AbortController permet l'annulation immédiate
// (<1ms) de la requête Claude en cours, sans attendre le timeout réseau.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map de sessionId AvatarKit → AbortController du stream Claude correspondant.
 * Le chat handler y enregistre le controller ; le handler barge-in l'annule.
 */
export const activeStreams = new Map<string, AbortController>()
