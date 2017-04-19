import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { PeersMesh, StudioRoom } from '@decode/studio-ui';

const mesh = new PeersMesh({
  roomName: 'hello world',
  localState: {
    name: '',
  },
});

mesh.connect().catch(error => console.error(error));

ReactDOM.render(
  <StudioRoom
    mesh={mesh}
    onUserAudioStream={(stream, previousStream) => {
      if (previousStream !== null) {
        mesh.removeLocalStream(previousStream);
      }
      mesh.addLocalStream(stream);
    }}
    onUserAudioError={(error, previousStream) => {
      console.error(error);
      if (previousStream !== null) {
        mesh.removeLocalStream(previousStream);
      }
    }}
  />,
  document.getElementById('root'),
);
