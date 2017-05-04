import * as React from 'react';
import { AudioVisualization } from './audio/AudioVisualization';
import { AudioDestination } from './audio/AudioDestination';
import { Peer, PeerState, PeerConnectionStatus } from './rtc/Peer';
import { EventListener } from './EventListener';

const StudioPeerName = EventListener.createComponent<
  { peer: Peer },
  PeerState | null,
  Peer.EventMap
>({
  initialState: ({ peer }) => peer.getRemoteState(),
  emitter: ({ peer }) => peer,
  events: { remoteStateChange: (_, data) => data },
  render: (_, state) => state === null ? null : (
    <span>
      {state.name}
      {state.isMuted === true && ' (muted)'}
    </span>
  ),
});

const StudioPeerConnectionStatus = EventListener.createComponent<
  { peer: Peer },
  PeerConnectionStatus,
  Peer.EventMap
>({
  initialState: ({ peer }) => peer.getConnectionStatus(),
  emitter: ({ peer }) => peer,
  events: { connectionStatusChange: (_, data) => data },
  render: (_, connectionStatus) => (
    <span>({PeerConnectionStatus[connectionStatus]})</span>
  ),
});

const StudioPeerAudio = EventListener.createComponent<
  { audioContext: AudioContext, peer: Peer, disableAudio: boolean },
  MediaStreamAudioSourceNode | null,
  Peer.EventMap
>({
  initialState: ({ audioContext, peer }) => {
    const stream = peer.getRemoteStream();
    return stream === null ? null : audioContext.createMediaStreamSource(stream);
  },
  emitter: ({ peer }) => peer,
  events: {
    remoteStreamChange: (_, stream, { audioContext }) =>
      stream === null ? null : audioContext.createMediaStreamSource(stream),
  },
  render: ({ audioContext, disableAudio }, source) => (
    <div style={{
      width: '500px',
      height: '100px',
      backgroundColor: 'tomato',
    }}>
      {source !== null && disableAudio === false && (
        <AudioDestination
          context={audioContext}
          node={source}
        />
      )}
      {source !== null && (
        <AudioVisualization
          node={source}
        />
      )}
    </div>
  ),
});

export const StudioPeer = ({
  peer,
  audioContext,
  disableAudio,
}: {
  peer: Peer,
  audioContext: AudioContext,
  disableAudio: boolean,
}) => (
  <div>
    <p>
      <StudioPeerName peer={peer}/>
      {' '}
      <StudioPeerConnectionStatus peer={peer}/>
    </p>
    <StudioPeerAudio
      peer={peer}
      audioContext={audioContext}
      disableAudio={disableAudio}
    />
  </div>
);
