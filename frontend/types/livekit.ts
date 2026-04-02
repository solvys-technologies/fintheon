// S13-T1: LiveKit room types for group voice calls

export interface LiveKitTokenRequest {
  roomName: string;
  participantName: string;
  participantIdentity: string;
}

export interface LiveKitTokenResponse {
  token: string;
  url: string;
}

export type CallState = 'idle' | 'connecting' | 'connected' | 'disconnecting' | 'error';

export interface CallParticipant {
  identity: string;
  displayName: string;
  isMuted: boolean;
  isSpeaking: boolean;
}
