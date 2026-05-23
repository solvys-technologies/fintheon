export interface ProxVoiceSocialLinks {
  x?: string;
  substack?: string;
  telegram?: string;
  discord?: string;
}

export interface ProxVoiceProfile {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  socialLinks: ProxVoiceSocialLinks;
}

export interface ProxVoicePresence {
  userId: string;
  surface: string;
  ticker: string | null;
  sessionId: string | null;
  muted: boolean;
  deafened: boolean;
  updatedAt: string;
  profile: ProxVoiceProfile;
}
