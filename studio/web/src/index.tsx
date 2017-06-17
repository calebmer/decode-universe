import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as querystring from 'querystring';
import { PeersMesh, StudioRoomController } from '@decode/studio-core';
import { MaybeHostPeer } from './rtc/MaybeHostPeer';
import { BuildConstants } from './BuildConstants';
import { StudioMustJoinRoom } from './StudioMustJoinRoom';

const StudioRoom = StudioRoomController.createComponent({
  createPeersMesh: ({ roomName, localAudioContext, previousLocalName }) =>
    new PeersMesh({
      signalServerURL: BuildConstants.SIGNAL_SERVER_URL,
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
    }),
});

const query = querystring.parse(location.search.slice(1));
const roomName = query['room'];

ReactDOM.render(
  !roomName ? <StudioMustJoinRoom /> : <StudioRoom roomName={roomName} />,
  document.getElementById('root'),
);
