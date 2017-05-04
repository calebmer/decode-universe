import * as React from 'react';
import { StudioRoomController, PeersMesh, Peer } from '@decode/studio-core';
import { Storage } from '../shared/storage/Storage';
import { StudioButtons } from './StudioButtons';

type ExtraProps = {
  storage: Storage,
  onBack: () => void,
};

export const StudioRoom = StudioRoomController.createComponent<ExtraProps, PeersMesh>({
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
  renderButtons: ({ storage, onBack }, { mesh }) => (
    <StudioButtons
      storage={storage}
      mesh={mesh}
      onBack={onBack}
    />
  ),
});
