import * as React from 'react';
import { Stream } from 'xstream';
import { ReactStream } from './stream/ReactStream';
import { AudioVisualization } from './audio/AudioVisualization';
import { AudioDestination } from './audio/AudioDestination';
import { Peer } from './rtc/Peer';

export function StudioPeer({
  peer,
  audioContext,
  disableAudio,
}: {
  peer: Peer;
  audioContext: AudioContext;
  disableAudio: Stream<boolean>;
}) {
  return (
    <div>
      <p>
        {ReactStream.render(peer.remoteState, state =>
          <span>
            {state.name}
            {state.isMuted === true && ' (muted)'}
          </span>,
        )}
        {' '}
        {ReactStream.render(peer.connectionStatus, connectionStatus =>
          <span>({Peer.ConnectionStatus[connectionStatus]})</span>,
        )}
      </p>
      {ReactStream.render(
        peer.remoteStream.map(
          stream =>
            stream !== null
              ? audioContext.createMediaStreamSource(stream)
              : null,
        ),
        source =>
          <div
            style={{
              width: '500px',
              height: '100px',
              backgroundColor: 'tomato',
            }}
          >
            {source !== null &&
              ReactStream.render(
                disableAudio,
                disableAudio =>
                  disableAudio === false &&
                  <AudioDestination context={audioContext} node={source} />,
              )}
            {source !== null && <AudioVisualization node={source} />}
          </div>,
      )}
    </div>
  );
}
