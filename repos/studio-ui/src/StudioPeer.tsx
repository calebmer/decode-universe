import * as React from 'react';
import { ReactObservable } from './observable/ReactObservable';
import { AudioVisualization } from './audio/AudioVisualization';
import { AudioDestination } from './audio/AudioDestination';
import { Peer, PeerConnectionStatus } from './rtc/Peer';

export function StudioPeer({
  peer,
  audioContext,
  disableAudioOutput = false,
}: {
  peer: Peer,
  audioContext: AudioContext,
  disableAudioOutput?: boolean,
}) {
  return (
    <div>
      <p>
        {ReactObservable.render(
          peer.remoteState,
          state => (
            <span>
              {state.name}
              {state.isMuted === true && ' (muted)'}
            </span>
          ),
        )}
        {' '}
        {ReactObservable.render(
          peer.connectionStatus,
          connectionStatus => (
            <span>({PeerConnectionStatus[connectionStatus]})</span>
          ),
        )}
      </p>
      {ReactObservable.render(
        peer.remoteStream
          .map(stream => stream !== null
            ? audioContext.createMediaStreamSource(stream)
            : null),
        source => (
          <div style={{
            width: '500px',
            height: '100px',
            backgroundColor: 'tomato',
          }}>
            {disableAudioOutput !== true && source !== null && (
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
      )}
    </div>
  )
}
