import * as React from 'react';
import { ReactObservable } from './observable/ReactObservable';
import { AudioVisualization } from './audio/AudioVisualization';
import { AudioDestination } from './audio/AudioDestination';
import { Peer, PeerConnectionStatus } from './rtc/Peer';

export function StudioPeer({
  peer,
  audioContext,
}: {
  peer: Peer,
  audioContext: AudioContext,
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
            {/* Only play audio in production. Most of the time in development
              * we will have multiple nodes open at once on one computer and the
              * feedback will be deadly to the ears.
              *
              * TODO: Is there a better way to save our ears in development
              * while still letting us test this feature? */}
            {!DEV && source !== null && (
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
