// [claude-code 2026-04-03] S14-T6: Extended presence payload with service status + user status
import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useSettings } from './SettingsContext';
import { useGateway } from './GatewayContext';
import { useFintheonAgents } from './FintheonAgentContext';
import { useSourceStatus } from '../hooks/useSourceStatus';
import type { TeamMember, PresencePayload, UserStatus } from '../types/team';

interface TeamPresenceContextValue {
  teamMembers: TeamMember[];
  isConnected: boolean;
  setUserStatus: (status: UserStatus) => void;
}

const TeamPresenceContext = createContext<TeamPresenceContextValue>({
  teamMembers: [],
  isConnected: false,
  setUserStatus: () => {},
});

export function TeamPresenceProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const { traderName } = useSettings();
  const { status: gatewayStatus, hermesStatus } = useGateway();
  const { agents } = useFintheonAgents();
  const sourceStatus = useSourceStatus();

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [userStatus, setUserStatusState] = useState<UserStatus>('online');
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);

  const caoName = agents.find((a) => a.id === 'harper-opus')?.name || 'Harper-Opus';
  const caoOnline = hermesStatus === 'ok' || gatewayStatus === 'connected';
  const displayName = traderName || 'Anonymous';

  const setUserStatus = useCallback((status: UserStatus) => {
    setUserStatusState(status);
  }, []);

  const buildPayload = useCallback((): PresencePayload => ({
    userId,
    displayName,
    caoName,
    caoOnline,
    twitterCliPolling: sourceStatus.twitterCli,
    inCall: false, // T3/T4 will wire this
    userStatus,
    services: {
      twitterCli: sourceStatus.twitterCli,
      aiRuntime: caoOnline,
      newsfeedPolling: {
        active: sourceStatus.notion || sourceStatus.twitterCli || sourceStatus.xApi,
        lastUpdate: new Date().toISOString(),
      },
      backendConnection: true, // always true if this code is running
    },
  }), [userId, displayName, caoName, caoOnline, sourceStatus.twitterCli, sourceStatus.notion, sourceStatus.xApi, userStatus]);

  // Connect to Supabase Realtime Presence channel
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase.channel('team-presence', {
      config: { presence: { key: userId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const members: TeamMember[] = [];

        for (const [key, presences] of Object.entries(state)) {
          // Take the latest presence entry for each user
          const latest = (presences as unknown as PresencePayload[])[0];
          if (!latest) continue;

          const defaultServices = {
            twitterCli: false,
            aiRuntime: false,
            newsfeedPolling: { active: false, lastUpdate: new Date().toISOString() },
            backendConnection: true,
          };
          members.push({
            userId: key,
            displayName: latest.displayName,
            caoName: latest.caoName,
            presence: {
              userId: key,
              displayName: latest.displayName,
              caoName: latest.caoName,
              caoOnline: latest.caoOnline,
              twitterCliPolling: latest.twitterCliPolling,
              online: true,
              lastSeen: new Date().toISOString(),
              inCall: latest.inCall,
              userStatus: latest.userStatus || 'online',
              services: latest.services || defaultServices,
            },
          });
        }

        setTeamMembers(members);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          await channel.track(buildPayload());
        }
      });

    channelRef.current = channel;

    return () => {
      channel.untrack();
      supabase?.removeChannel(channel);
      channelRef.current = null;
      setIsConnected(false);
    };
    // Only re-subscribe when userId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Update tracked presence when local state changes
  useEffect(() => {
    if (!channelRef.current || !isConnected) return;
    channelRef.current.track(buildPayload());
  }, [buildPayload, isConnected]);

  return (
    <TeamPresenceContext.Provider value={{ teamMembers, isConnected, setUserStatus }}>
      {children}
    </TeamPresenceContext.Provider>
  );
}

export const useTeamPresence = () => useContext(TeamPresenceContext);
