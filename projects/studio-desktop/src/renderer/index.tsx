import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { StudioRoomController, PeersMesh, Peer } from '@decode/studio-core';
import { Storage } from './storage/Storage';
import { StudioButtons } from './StudioButtons';

const StudioRoom = StudioRoomController.createComponent<{ storage: Storage }, PeersMesh>({
  createPeersMesh: ({
    roomName,
    localAudioContext,
    previousLocalName,
  }) => (
    new PeersMesh({
      roomName,
      localAudioContext,
      localState: {
        name: previousLocalName || 'Host',
        isMuted: false,
      },
      createPeerInstance: config => new Peer(config),
    })
  ),
  renderButtons: ({ storage }, { mesh }) => (
    <StudioButtons
      storage={storage}
      mesh={mesh}
    />
  ),
});

Storage.open('/Users/calebmer/Desktop/decode').then(
  storage => {
    ReactDOM.render((
      <StudioRoom
        roomName="hello world"
        storage={storage}
      />
    ), document.getElementById('root'));
  },
  error => {
    console.error(error);
  },
);
