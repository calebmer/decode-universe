import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { PeersMesh, StudioRoom } from '@decode/studio-ui';
import { MaybeHostPeer } from './rtc/MaybeHostPeer';

const mesh = new PeersMesh({
  roomName: 'hello world',
  localState: {
    name: '',
  },
  // We don’t have any information to tell at this point whether or not the peer
  // we are instantiating is a guest or host. So instead we use a
  // `MaybeHostPeer` to handle both cases. It will adapt based on information
  // transmit accross the connection. We won’t actually know whether or not a
  // peer is a host until either the connection has closed, or the peer lets us
  // know that it is a host.
  createPeerInstance: config => new MaybeHostPeer(config),
});

// Expose the mesh instance for debugging in development.
if (DEV) {
  (window as any).mesh = mesh;
}

mesh.connect().catch(error => console.error(error));

ReactDOM.render(
  <StudioRoom
    mesh={mesh}
    onUserAudioStream={(stream, previousStream) => {
      mesh.addLocalStream(stream);
      if (previousStream !== null) {
        mesh.removeLocalStream(previousStream);
      }
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
