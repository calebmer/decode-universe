import * as React from 'react';
import { StudioRoomController, PeersMesh, Peer } from '@decode/studio-core';
import { Storage } from '../shared/storage/Storage';
import { StudioButtons } from './StudioButtons';

export const StudioRoom = StudioRoomController.createComponent<{ storage: Storage }, PeersMesh>({
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
