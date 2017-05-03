import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { PeersMesh, StudioRoomController } from '@decode/studio-core';
import { MaybeHostPeer } from './rtc/MaybeHostPeer';

const StudioRoom = StudioRoomController.createComponent({
  createPeersMesh: ({
    roomName,
    localAudioContext,
    previousLocalName,
  }) => (
    new PeersMesh({
      roomName,
      localAudioContext,
      localState: {
        name: previousLocalName || 'Guest',
        isMuted: false,
      },
      // We don’t have any information to tell at this point whether or not the peer
      // we are instantiating is a guest or host. So instead we use a
      // `MaybeHostPeer` to handle both cases. It will adapt based on information
      // transmit accross the connection. We won’t actually know whether or not a
      // peer is a host until either the connection has closed, or the peer lets us
      // know that it is a host.
      createPeerInstance: config => new MaybeHostPeer(config),
    })
  ),
});

ReactDOM.render(
  <StudioRoom roomName="hello world"/>,
  document.getElementById('root'),
);
