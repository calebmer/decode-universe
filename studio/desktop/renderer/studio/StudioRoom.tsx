import * as React from 'react';
import StudioRoomController from '~/studio/core/StudioRoomController';
import PeersMesh from '~/studio/core/rtc/PeersMesh';
import Peer from '~/studio/core/rtc/Peer';
import Storage from '../storage/Storage';
import StudioButtons from './StudioButtons';

type ExtraProps = {
  storage: Storage;
  onBack: () => void;
};

const StudioRoom = StudioRoomController.createComponent<ExtraProps, PeersMesh>({
  // We want the host to invite users to the room using the web url.
  webURL: BuildConstants.STUDIO_WEB_URL,

  createPeersMesh: ({ roomName, localAudioContext, previousLocalName }) =>
    new PeersMesh({
      signalServerURL: BuildConstants.STUDIO_SIGNAL_SERVER_URL,
      roomName,
      localAudioContext,
      localState: {
        name: previousLocalName || 'Host',
        isMuted: false,
      },
      createPeerInstance: config => new Peer(config),
    }),
  renderButtons: ({ storage, onBack }, { mesh }) =>
    <StudioButtons storage={storage} mesh={mesh} onBack={onBack} />,
});

export default StudioRoom;
