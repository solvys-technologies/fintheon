// [claude-code 2026-04-19] S26 hotfix: guarded sourceStatus.userPollStats[userId] access.
//   When a user had a cached `sourceStatus` from before S25-T4 added the userPollStats
//   field, `sourceStatus.userPollStats` was undefined and `[userId]` threw on mount,
//   blowing up the whole app into an error boundary with TP's sub shown in the message.
// [claude-code 2026-04-11] Renamed twitter → rettiwt/riskflow for X CLI removal + round-robin
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import { useSettings } from "./SettingsContext";
import { useGateway } from "./GatewayContext";
import { useFintheonAgents } from "./FintheonAgentContext";
import { useSourceStatus } from "../hooks/useSourceStatus";
import { useToast } from "./ToastContext";
import type { TeamMember, PresencePayload, UserStatus } from "../types/team";

interface TeamPresenceContextValue {
  teamMembers: TeamMember[];
  isConnected: boolean;
  setUserStatus: (status: UserStatus) => void;
  riskflowKilled: boolean;
  toggleRiskFlow: () => void;
}

const TeamPresenceContext = createContext<TeamPresenceContextValue>({
  teamMembers: [],
  isConnected: false,
  setUserStatus: () => {},
  riskflowKilled: false,
  toggleRiskFlow: () => {},
});

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

export function TeamPresenceProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const { traderName } = useSettings();
  const { status: gatewayStatus, hermesStatus } = useGateway();
  const { agents } = useFintheonAgents();
  const sourceStatus = useSourceStatus();
  const { addToast } = useToast();
  const prevRateLimited = useRef(false);

  // Toast when Rettiwt 429 kicks in or recovers
  useEffect(() => {
    if (sourceStatus.rettiwtRateLimited && !prevRateLimited.current) {
      addToast(
        `X rate limited — cooling down ${sourceStatus.rettiwtCooldownSec}s`,
        "info",
        undefined,
        "connection-status",
      );
    } else if (!sourceStatus.rettiwtRateLimited && prevRateLimited.current) {
      addToast("X polling resumed", "success", undefined, "connection-status");
    }
    prevRateLimited.current = sourceStatus.rettiwtRateLimited;
  }, [
    sourceStatus.rettiwtRateLimited,
    sourceStatus.rettiwtCooldownSec,
    addToast,
  ]);

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [userStatus, setUserStatusState] = useState<UserStatus>("online");
  const [riskflowKilled, setRiskflowKilled] = useState(
    () => localStorage.getItem("fintheon:riskflow-killed") === "true",
  );
  const channelRef = useRef<ReturnType<
    NonNullable<typeof supabase>["channel"]
  > | null>(null);

  const caoName = agents.find((a) => a.id === "harper")?.name || "Harper";
  const caoOnline = hermesStatus === "ok" || gatewayStatus === "connected";
  const displayName = traderName || "Anonymous";

  const setUserStatus = useCallback((status: UserStatus) => {
    setUserStatusState(status);
  }, []);

  const toggleRiskFlow = useCallback(() => {
    setRiskflowKilled((prev) => {
      const next = !prev;
      localStorage.setItem("fintheon:riskflow-killed", String(next));
      fetch(`${API_BASE}/api/riskflow/user-polling-toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, killed: next }),
      }).catch(() => {});
      return next;
    });
  }, [userId]);

  // [claude-code 2026-04-18] S25-T4: Broadcast unified newsfeedHealthy + per-user lastSuccessAt
  // so peers see truthful aggregated feed health and a per-card "Polled Nm ago" line.
  const myStats = sourceStatus.userPollStats?.[userId];
  const buildPayload = useCallback(
    (): PresencePayload => ({
      userId,
      displayName,
      caoName,
      caoOnline,
      riskflowPolling: riskflowKilled ? false : sourceStatus.rettiwt,
      riskflowKilled,
      inCall: false,
      userStatus,
      services: {
        rettiwt: riskflowKilled ? false : sourceStatus.rettiwt,
        rettiwtRateLimited: sourceStatus.rettiwtRateLimited,
        rettiwtNoKeys: sourceStatus.rettiwtPool?.totalKeys === 0,
        riskflowKilled,
        aiRuntime: caoOnline,
        newsfeedPolling: {
          active: sourceStatus.backendReachable && sourceStatus.newsfeedHealthy,
          lastUpdate: sourceStatus.lastPollSuccess,
        },
        backendConnection: sourceStatus.backendReachable,
        newsfeedHealthy: sourceStatus.newsfeedHealthy,
        newsfeedDegraded: sourceStatus.newsfeedDegraded,
        agentReachActive: sourceStatus.agentReach.active,
        lastSuccessAt: myStats?.lastSuccessAt ?? null,
        totalContributions: myStats?.totalContributions ?? 0,
      },
    }),
    [
      userId,
      displayName,
      caoName,
      caoOnline,
      sourceStatus.rettiwt,
      sourceStatus.rettiwtRateLimited,
      sourceStatus.rettiwtPool?.totalKeys,
      sourceStatus.backendReachable,
      sourceStatus.lastPollSuccess,
      sourceStatus.newsfeedHealthy,
      sourceStatus.newsfeedDegraded,
      sourceStatus.agentReach.active,
      myStats?.lastSuccessAt,
      myStats?.totalContributions,
      userStatus,
      riskflowKilled,
    ],
  );

  // Connect to Supabase Realtime Presence channel
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase.channel("team-presence", {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const members: TeamMember[] = [];

        for (const [key, presences] of Object.entries(state)) {
          const latest = (presences as unknown as PresencePayload[])[0];
          if (!latest) continue;

          const defaultServices = {
            rettiwt: false,
            rettiwtRateLimited: false,
            rettiwtNoKeys: true,
            riskflowKilled: false,
            aiRuntime: false,
            newsfeedPolling: {
              active: false,
              lastUpdate: new Date().toISOString(),
            },
            backendConnection: false,
            newsfeedHealthy: false,
            newsfeedDegraded: false,
            agentReachActive: false,
            lastSuccessAt: null,
            totalContributions: 0,
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
              riskflowPolling: (latest as any).riskflowPolling ?? false,
              riskflowKilled: (latest as any).riskflowKilled ?? false,
              online: true,
              lastSeen: new Date().toISOString(),
              inCall: latest.inCall,
              userStatus: latest.userStatus || "online",
              services: latest.services || defaultServices,
            },
          });
        }

        setTeamMembers(members);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
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
    <TeamPresenceContext.Provider
      value={{
        teamMembers,
        isConnected,
        setUserStatus,
        riskflowKilled,
        toggleRiskFlow,
      }}
    >
      {children}
    </TeamPresenceContext.Provider>
  );
}

export const useTeamPresence = () => useContext(TeamPresenceContext);
