import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { PeersMesh, StudioRoom } from '@decode/studio-ui';
import { MaybeHostPeer } from './rtc/MaybeHostPeer';

const nameKey = '@decode/studio-web/name';

const mesh = new PeersMesh({
  roomName: 'hello world',
  localState: {
    name: localStorage.getItem(nameKey) || 'Guest',
    isMuted: DEV,
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
    onNameChange={name => {
      // Update the local state in the mesh with the new name.
      mesh.setLocalName(name);
      // Update local storage with the new information.
      localStorage.setItem(nameKey, name);
    }}
    onUserAudioStream={stream => mesh.setLocalStream(stream)}
    onUserAudioError={error => {
      console.error(error);
      mesh.unsetLocalStream();
    }}
  />,
  document.getElementById('root'),
);
