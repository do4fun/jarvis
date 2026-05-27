// ─────────────────────────────────────────────────────────────────────────────
// AvatarKit SDK & SpatialReal UI — contrats TypeScript
//
// Ces types définissent la surface publique de :
//   @spatialreal/avatarkit-sdk   (gestion session + WebRTC)
//   @spatialreal/avatarkit-ui    (composant React <video>)
//
// Optimisation latence : toute la signalisation WebRTC est asynchrone et
// non-bloquante ; les candidats ICE sont envoyés en trickle (pas d'attente
// de la liste complète) pour réduire le temps d'établissement de connexion.
// ─────────────────────────────────────────────────────────────────────────────

// ── Création de session ───────────────────────────────────────────────────────

/** Config passée à l'ouverture d'une session de streaming AvatarKit */
export interface AvatarKitSessionConfig {
  /** ID de l'avatar pré-configuré dans le dashboard SpatialReal */
  avatarId: string
  /**
   * Qualité de rendu — compromis débit/fidélité visuelle.
   * 'low' cible ≤1 Mbps ; 'high' cible ~4 Mbps.
   */
  quality: 'low' | 'medium' | 'high'
  /** Code BCP-47 pour la synthèse vocale (ex. 'fr-FR', 'en-US') */
  language?: string
  /** Identifiant de voix dans la bibliothèque SpatialReal */
  voiceId?: string
}

/** Descripteur de session retourné par l'API REST AvatarKit */
export interface AvatarKitSessionDescriptor {
  /** Identifiant opaque — à transmettre au client pour la signalisation WebRTC */
  sessionId: string
  /** Offre SDP produite par le serveur média AvatarKit */
  sdpOffer: RTCSessionDescriptionInit
  /** Serveurs STUN/TURN pour la collecte des candidats ICE */
  iceServers: RTCIceServer[]
  /** Expiration de session — fermeture automatique après cette epoch (secondes) */
  expiresAt: number
}

// ── Ingestion de texte ────────────────────────────────────────────────────────

/** Payload pour pousser un fragment de texte dans le flux TTS actif */
export interface AvatarKitTextChunk {
  /** Doit correspondre à un sessionId ouvert */
  sessionId: string
  /** Fragment de texte brut — peut être aussi court qu'un token unique */
  text: string
  /**
   * Mettre à `true` sur le *dernier* chunk d'un énoncé.
   * Signal au moteur TTS pour finaliser la prosodie et le lip-sync.
   *
   * Optimisation latence : NE PAS attendre `flush` pour envoyer du texte —
   * chaque token Claude est envoyé immédiatement, sans batching ni buffering.
   */
  flush?: boolean
}

// ── Interruption / arrêt ──────────────────────────────────────────────────────

/** Corps de requête pour l'endpoint d'interruption (barge-in) */
export interface AvatarKitInterruptPayload {
  sessionId: string
}

// ── Signalisation WebRTC ──────────────────────────────────────────────────────

/** Réponse SDP du RTCPeerConnection du navigateur */
export interface AvatarKitSdpAnswer {
  sessionId: string
  sdpAnswer: RTCSessionDescriptionInit
}

/** Candidat ICE du navigateur (trickle ICE) */
export interface AvatarKitIceCandidate {
  sessionId: string
  candidate: RTCIceCandidateInit
}

// ── Messages WebSocket STT ─────────────────────────────────────────────────────

/**
 * Messages du navigateur → endpoint WebSocket /ws/stt
 *
 * Optimisation latence : l'audio est envoyé en PCM16 brut (pas d'encodage
 * mp3/opus) pour éviter la latence de codec côté navigateur.
 */
export type WsClientMessage =
  | {
      type: 'audio_chunk'
      /** ArrayBuffer PCM16 encodé en base64 (128 samples = 8ms @ 16kHz) */
      data: string
    }
  | {
      type: 'barge_in'
      /** Session AvatarKit à interrompre immédiatement */
      avatarSessionId: string
    }
  | { type: 'config'; language: string }

/** Messages du backend STT WebSocket → navigateur */
export type WsServerMessage =
  | {
      type: 'transcript'
      text: string
      /** true = transcript définitif ; false = intermédiaire (interim) */
      isFinal: boolean
    }
  | { type: 'error'; message: string }
  | { type: 'ready' }

// ── État du store Zustand ─────────────────────────────────────────────────────

/** États de connexion pour la session WebRTC AvatarKit */
export type AvatarKitConnectionStatus =
  | 'idle'        // Aucune session
  | 'creating'    // Appel REST en cours vers AvatarKit API
  | 'negotiating' // Échange SDP/ICE en cours
  | 'connected'   // WebRTC établi, flux vidéo reçu
  | 'speaking'    // Avatar en train de parler (TTS actif)
  | 'interrupted' // Barge-in déclenché, retour vers idle
  | 'error'
  | 'closed'

export interface AvatarKitStoreState {
  status: AvatarKitConnectionStatus
  sessionId: string | null
  /** Flux MediaStream reçu via WebRTC — attaché au <video> */
  mediaStream: MediaStream | null
  error: string | null
}
