import ApiClient from "../apiClient";

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
  bio: string | null;
  position: string | null;
  broker: string | null;
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

export class ProxVoiceService {
  constructor(private client: ApiClient) {}

  async token(): Promise<{ token: string; url: string; roomName: string }> {
    return this.client.post("/api/proxvoice/token", {});
  }

  async participants(): Promise<{ participants: ProxVoicePresence[] }> {
    return this.client.get("/api/proxvoice/participants");
  }

  async presence(data: {
    surface?: string;
    ticker?: string | null;
    sessionId?: string | null;
    muted?: boolean;
    deafened?: boolean;
  }): Promise<{ presence: ProxVoicePresence }> {
    return this.client.post("/api/proxvoice/presence", data);
  }

  async getSocialLinks(): Promise<{ socialLinks: ProxVoiceSocialLinks }> {
    return this.client.get("/api/profile/social-links");
  }

  async updateSocialLinks(
    socialLinks: ProxVoiceSocialLinks,
  ): Promise<{ socialLinks: ProxVoiceSocialLinks }> {
    return this.client.put("/api/profile/social-links", { socialLinks });
  }

  async getProfile(): Promise<{ profile: ProxVoiceProfile }> {
    return this.client.get("/api/profile/voice-profile");
  }

  async updateProfile(data: {
    displayName?: string;
    avatarUrl?: string | null;
    bio?: string | null;
    position?: string | null;
    broker?: string | null;
    socialLinks?: ProxVoiceSocialLinks;
  }): Promise<{ profile: ProxVoiceProfile }> {
    return this.client.put("/api/profile/voice-profile", data);
  }
}
