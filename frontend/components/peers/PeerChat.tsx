// [claude-code 2026-05-12] PeerChat stub — placeholder for peer-to-peer chat surface
// Imported by ConsiliumHub but implementation deferred.

export function PeerChat({
  localPeerId,
  localAgentName,
}: {
  localPeerId: string;
  localAgentName: string;
}) {
  return (
    <div className="flex items-center justify-center h-full text-xs text-zinc-500">
      Peer chat coming soon (agent: {localAgentName})
    </div>
  );
}
