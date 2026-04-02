// S13-T3: LiveKit room hook for group voice calls
import { useState, useRef, useCallback, useEffect } from 'react';
import { Room, RoomEvent, createLocalAudioTrack, type LocalAudioTrack, type Participant, type RemoteParticipant } from 'livekit-client';
import type { CallState, CallParticipant, LiveKitTokenResponse } from '../types/livekit';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

async function fetchToken(roomName: string, displayName: string, userId: string): Promise<LiveKitTokenResponse> {
  const res = await fetch(`${API_BASE}/api/livekit/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomName, participantName: displayName, participantIdentity: userId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Token request failed' }));
    throw new Error(err.error || `Token request failed: ${res.status}`);
  }
  return res.json();
}

function participantToCallParticipant(p: Participant, speakers: Set<string>): CallParticipant {
  return {
    identity: p.identity,
    displayName: p.name || p.identity,
    isMuted: !p.isMicrophoneEnabled,
    isSpeaking: speakers.has(p.identity),
  };
}

export function useLiveKitRoom() {
  const { userId } = useAuth();
  const { traderName } = useSettings();
  const roomRef = useRef<Room | null>(null);
  const localTrackRef = useRef<LocalAudioTrack | null>(null);

  const [callState, setCallState] = useState<CallState>('idle');
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const speakersRef = useRef<Set<string>>(new Set());

  const refreshParticipants = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const list: CallParticipant[] = [];
    list.push(participantToCallParticipant(room.localParticipant, speakersRef.current));
    room.remoteParticipants.forEach((p) => {
      list.push(participantToCallParticipant(p, speakersRef.current));
    });
    setParticipants(list);
  }, []);

  const connect = useCallback(async (roomName: string) => {
    if (roomRef.current) return;
    setCallState('connecting');
    setError(null);

    try {
      const { token, url } = await fetchToken(roomName, traderName || 'Trader', userId);

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      room.on(RoomEvent.ParticipantConnected, () => refreshParticipants());
      room.on(RoomEvent.ParticipantDisconnected, () => refreshParticipants());
      room.on(RoomEvent.TrackMuted, () => refreshParticipants());
      room.on(RoomEvent.TrackUnmuted, () => refreshParticipants());
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        speakersRef.current = new Set(speakers.map((s) => s.identity));
        refreshParticipants();
      });
      room.on(RoomEvent.Disconnected, () => {
        setCallState('idle');
        setParticipants([]);
        roomRef.current = null;
      });

      await room.connect(url, token);
      roomRef.current = room;

      const localTrack = await createLocalAudioTrack();
      await room.localParticipant.publishTrack(localTrack);
      localTrackRef.current = localTrack;

      setCallState('connected');
      setIsMuted(false);
      refreshParticipants();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect';
      setError(message);
      setCallState('error');
      roomRef.current = null;
    }
  }, [userId, traderName, refreshParticipants]);

  const disconnect = useCallback(async () => {
    setCallState('disconnecting');
    if (localTrackRef.current) {
      localTrackRef.current.stop();
      localTrackRef.current = null;
    }
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    setCallState('idle');
    setParticipants([]);
    setIsMuted(false);
    setError(null);
  }, []);

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !isMuted;
    await room.localParticipant.setMicrophoneEnabled(!next);
    setIsMuted(next);
    refreshParticipants();
  }, [isMuted, refreshParticipants]);

  useEffect(() => {
    return () => {
      localTrackRef.current?.stop();
      roomRef.current?.disconnect();
    };
  }, []);

  return { connect, disconnect, toggleMute, callState, participants, isMuted, error };
}
