// [claude-code 2026-04-01] Renders <AudioTrack> for each remote mic — no visible UI
import { useTracks, AudioTrack } from '@livekit/components-react';
import { Track } from 'livekit-client';

export function VoiceAudioRenderer() {
  const tracks = useTracks(
    [{ source: Track.Source.Microphone, withPlaceholder: false }],
    { onlySubscribed: true },
  );

  return (
    <>
      {tracks
        .filter((ref) => ref.publication && !ref.participant.isLocal)
        .map((ref) => (
          <AudioTrack
            key={`${ref.participant.identity}-mic`}
            trackRef={ref}
          />
        ))}
    </>
  );
}
