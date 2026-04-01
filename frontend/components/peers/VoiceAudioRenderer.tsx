// [claude-code 2026-04-01] Renders <AudioTrack> for each remote mic — no visible UI
import { useTracks, AudioTrack, isTrackReference } from '@livekit/components-react';
import type { TrackReference } from '@livekit/components-core';
import { Track } from 'livekit-client';

export function VoiceAudioRenderer() {
  const tracks = useTracks(
    [{ source: Track.Source.Microphone, withPlaceholder: false }],
    { onlySubscribed: true },
  );

  const remoteTracks: TrackReference[] = tracks.filter(
    (ref): ref is TrackReference => isTrackReference(ref) && !ref.participant.isLocal,
  );

  return (
    <>
      {remoteTracks.map((ref) => (
        <AudioTrack
          key={`${ref.participant.identity}-mic`}
          trackRef={ref}
        />
      ))}
    </>
  );
}
