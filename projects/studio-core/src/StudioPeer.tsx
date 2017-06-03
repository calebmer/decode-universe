import * as React from 'react';
import { Observable } from 'rxjs';
import { ReactObservable } from './observable/ReactObservable';
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
  disableAudio: Observable<boolean>;
}) {
  return (
    <div>
      <p>
        {ReactObservable.render(peer.remoteState, state =>
          <span>
            {state.name}
            {state.isMuted === true && ' (muted)'}
          </span>,
        )}
        {' '}
        {ReactObservable.render(peer.connectionStatus, connectionStatus =>
          <span>({Peer.ConnectionStatus[connectionStatus]})</span>,
        )}
      </p>
      {ReactObservable.render(
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
              ReactObservable.render(
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
