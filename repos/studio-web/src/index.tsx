import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Set } from 'immutable';
import { BehaviorSubject } from 'rxjs';
import { PeersMesh, StudioRoom } from '@decode/studio-ui';

const userStream = new BehaviorSubject<MediaStream | null>(null);

const mesh = new PeersMesh({
  roomName: 'hello world',
  localStreams: userStream.map((stream): Set<MediaStream> =>
    stream === null ? Set<MediaStream>() : Set([stream])
  ),
});

mesh.connect().catch(error => console.error(error));

ReactDOM.render(
  <StudioRoom
    mesh={mesh}
    onUserAudioStream={stream => userStream.next(stream)}
    onUserAudioError={error => {
      console.error(error);
      userStream.next(null);
    }}
  />,
  document.getElementById('root'),
);