import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { StudioRoomController } from '@decode/studio-core';
import { HostPeersMesh } from './rtc/HostPeersMesh';
import { StudioButtons } from './StudioButtons';

const StudioRoom = StudioRoomController.createComponent<HostPeersMesh>({
  createPeersMesh: ({
    roomName,
    localAudioContext,
    previousLocalName,
  }) => (
    new HostPeersMesh({
      roomName,
      localAudioContext,
      localState: {
        name: previousLocalName || 'Host',
        isMuted: false,
      },
    })
  ),

  renderButtons: ({ mesh }) => <StudioButtons mesh={mesh}/>,
});

ReactDOM.render(
  <StudioRoom roomName="hello world"/>,
  document.getElementById('root'),
);
