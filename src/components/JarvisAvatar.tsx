"use client";

// ─────────────────────────────────────────────────────────────────────────────
// JarvisAvatar — Logique avatar copiée du demo spatialwalk/avatarkit-voice-agent-demo
// Layout full-screen + chat texte Claude + bouton micro
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AvatarManager,
  AvatarSDK,
  AvatarView,
  DrivingServiceMode,
  Environment,
} from "@spatialwalk/avatarkit";
import { AvatarPlayer, LiveKitProvider } from "@spatialwalk/avatarkit-rtc";
import { Room, Track } from "livekit-client";
import { Mic, MicOff, RefreshCw } from "lucide-react";
import ChatOverlay from "@/components/ui/ChatOverlay";

export default function JarvisAvatar() {
  // ── Refs (même pattern que le demo) ─────────────────────────────────────────
  const containerRef          = useRef<HTMLDivElement | null>(null);
  const avatarViewRef         = useRef<AvatarView | null>(null);
  const avatarPlayerRef       = useRef<AvatarPlayer | null>(null);
  const roomRef               = useRef<Room | null>(null);
  const initializedRef        = useRef(false);
  const roomListenersSetupRef = useRef(false);
  const disconnectingRef      = useRef(false);
  const teardownTaskRef       = useRef<Promise<void> | null>(null);

  const [isLoading,      setIsLoading]      = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [containerReady, setContainerReady] = useState(false);
  const [micTrack,       setMicTrack]       = useState<Track | undefined>(undefined);

  // ── teardown (identique au demo) ─────────────────────────────────────────────
  const teardownAvatar = useCallback(async () => {
    if (teardownTaskRef.current) {
      await teardownTaskRef.current;
      return;
    }
    const player = avatarPlayerRef.current;
    const view   = avatarViewRef.current;
    avatarPlayerRef.current       = null;
    avatarViewRef.current         = null;
    roomRef.current               = null;
    roomListenersSetupRef.current = false;
    initializedRef.current        = false;

    teardownTaskRef.current = (async () => {
      try { await player?.disconnect(); } catch {}
      try { view?.dispose?.(); }         catch (e) { console.warn("Failed to dispose avatar view:", e); }
    })();
    try      { await teardownTaskRef.current; }
    finally  { teardownTaskRef.current = null; }
  }, []);

  // ── setContainerRef (identique au demo — requestAnimationFrame uniquement) ───
  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    if (!node) return;
    requestAnimationFrame(() => {
      if (node.offsetWidth > 0 && node.offsetHeight > 0) setContainerReady(true);
    });
  }, []);

  // ── initializeAvatar (identique au demo, token depuis /api/token) ─────────────
  const initializeAvatar = useCallback(async () => {
    if (!containerRef.current || initializedRef.current) return;
    if (containerRef.current.offsetWidth === 0 || containerRef.current.offsetHeight === 0) return;
    initializedRef.current = true;

    try {
      setIsLoading(true);
      setError(null);

      const appId    = process.env.NEXT_PUBLIC_SPATIALREAL_APP_ID;
      const avatarId = process.env.NEXT_PUBLIC_AVATARKIT_AVATAR_ID
                    ?? process.env.NEXT_PUBLIC_SPATIALREAL_AVATAR_ID;

      if (!appId || !avatarId) throw new Error("NEXT_PUBLIC_SPATIALREAL_APP_ID ou AVATARKIT_AVATAR_ID manquant");

      if (!AvatarSDK.isInitialized) {
        await AvatarSDK.initialize(appId, {
          environment:        Environment.intl,
          drivingServiceMode: DrivingServiceMode.host,
        });
      }

      const avatar     = await AvatarManager.shared.load(avatarId);
      const avatarView = new AvatarView(avatar, containerRef.current);
      avatarViewRef.current = avatarView;

      // Token LiveKit depuis notre backend
      const tokenRes = await fetch("/api/token", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ room: "jarvis-room" }),
      });
      if (!tokenRes.ok) throw new Error(`Token error ${tokenRes.status}`);
      const { token, url: serverUrl, room: roomName } =
        await tokenRes.json() as { token: string; url: string; room: string };

      const provider = new LiveKitProvider();
      const player   = new AvatarPlayer(
        provider as unknown as ConstructorParameters<typeof AvatarPlayer>[0],
        avatarView,
        { logLevel: "info" },
      );

      player.on("connected", () => {
        setIsLoading(false);
        const room = player.getNativeClient() as Room | null;
        if (room) roomRef.current = room;
      });

      player.on("disconnected", () => {
        if (!disconnectingRef.current) setError("Avatar déconnecté");
      });

      player.on("error", (err: Error) => {
        setError(err.message);
        setIsLoading(false);
      });

      player.on("stalled", async () => {
        try { await player.reconnect(); }
        catch { setError("Avatar stream déconnecté"); }
      });

      await player.connect({ url: serverUrl, token, roomName });
      avatarPlayerRef.current = player;

      // Activer le micro au démarrage
      await player.startPublishing();
      const room = player.getNativeClient() as Room | null;
      if (room?.localParticipant) {
        const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
        if (pub?.track) setMicTrack(pub.track);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec d'initialisation de l'avatar");
      setIsLoading(false);
      initializedRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!containerReady) return;
    void initializeAvatar();
    return () => {
      disconnectingRef.current = true;
      void teardownAvatar();
    };
  }, [containerReady, initializeAvatar, teardownAvatar]);

  // ── Toggle micro ─────────────────────────────────────────────────────────────
  const toggleMic = useCallback(async () => {
    const player = avatarPlayerRef.current;
    if (!player) return;
    if (micTrack) {
      await player.stopPublishing();
      setMicTrack(undefined);
    } else {
      await player.startPublishing();
      const room = player.getNativeClient() as Room | null;
      const pub  = room?.localParticipant.getTrackPublication(Track.Source.Microphone);
      if (pub?.track) setMicTrack(pub.track);
    }
  }, [micTrack]);

  const handleReconnect = useCallback(() => {
    initializedRef.current  = false;
    disconnectingRef.current = false;
    setError(null);
    void teardownAvatar().then(() => initializeAvatar());
  }, [teardownAvatar, initializeAvatar]);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0f0f1a]">

      {/* Container avatar — identique au demo : div direct sans wrapper */}
      <div ref={setContainerRef} className="h-full w-full" />

      {/* Chargement */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#0f0f1a]">
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 animate-ping rounded-full bg-blue-500/20" />
            <div className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-t-blue-400" />
          </div>
          <p className="text-sm tracking-widest uppercase text-blue-300/60">
            Connexion Jarvis…
          </p>
        </div>
      )}

      {/* Erreur */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#0f0f1a]">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={handleReconnect}
            className="flex items-center gap-2 rounded-lg border border-blue-500/30 px-4 py-2 text-xs text-blue-300 hover:bg-blue-500/10 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reconnecter
          </button>
        </div>
      )}

      {/* Bouton micro — en bas à droite */}
      {!isLoading && !error && (
        <button
          onClick={() => void toggleMic()}
          className={`absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full border transition-all ${
            micTrack
              ? "border-blue-400/60 bg-blue-500/20 text-blue-300 shadow-lg shadow-blue-500/20"
              : "border-white/20 bg-black/40 text-white/50 hover:text-white/80"
          }`}
          aria-label={micTrack ? "Couper le micro" : "Activer le micro"}
        >
          {micTrack ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </button>
      )}

      {/* Chat texte Claude — overlay en bas */}
      <ChatOverlay />
    </div>
  );
}
