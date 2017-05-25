import * as React from 'react';
import { StudioRoomController, PeersMesh, Peer } from '@decode/studio-core';
import { Storage } from '../shared/storage/Storage';
import { StudioButtons } from './StudioButtons';

type ExtraProps = {
  storage: Storage,
  onBack: () => void,
};

export const StudioRoom = StudioRoomController.createComponent<ExtraProps, PeersMesh>({
  // We want the host to invite users to the room using the web url.
  webURL: WEB_URL,

  createPeersMesh: ({
    roomName,
    localAudioContext,
    previousLocalName,
  }) => (
    new PeersMesh({
      signalServerURL: SIGNAL_SERVER_URL,
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
