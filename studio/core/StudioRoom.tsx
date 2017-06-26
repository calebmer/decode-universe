import * as React from 'react';
import { Stream } from 'xstream';
import dropRepeats from 'xstream/extra/dropRepeats';
import { css } from 'glamor';
import ReactStream from './stream/ReactStream';
import AudioVisualization from './audio/AudioVisualization';
// import AudioPeakMeter from './audio/AudioPeakMeter';
import PeersMesh from './rtc/PeersMesh';
import StudioRoomHeader from './StudioRoomHeader';
import StudioRoomOptionsPanel from './StudioRoomOptionsPanel';
import StudioPeer from './StudioPeer';
import StudioRoomParticipants from './StudioRoomParticipants';

export default function StudioRoom({
  mesh,
  audioContext,
  deviceID,
  onSelectDeviceID,
  disableAudio,
  onDisableAudio,
  onEnableAudio,
  localVolume,
  onLocalVolumeChange,
  webURL,
}: {
  mesh: PeersMesh;
  audioContext: AudioContext;
  deviceID: Stream<string | null>;
  onSelectDeviceID: (deviceID: string) => void;
  disableAudio: Stream<boolean>;
  onDisableAudio: () => void;
  onEnableAudio: () => void;
  localVolume: Stream<number>;
  onLocalVolumeChange: (localVolume: number) => void;
  webURL: string | null;
}) {
  const handleMute = () => mesh.muteLocalAudio();
  const handleUnmute = () => mesh.unmuteLocalAudio();

  return (
    <div
      {...css({
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      })}
    >
      <header>
        <StudioRoomHeader />
      </header>
      <div
        {...css({
          flexGrow: '1',
          display: 'flex',
        })}
      >
        <aside
          {...css({
            order: '1',
            flexShrink: '0',
            overflow: 'scroll',
            margin: '4em',
            marginLeft: '0',
            marginRight: '4em',
          })}
        >
          <StudioRoomOptionsPanel
            name={mesh.localState
              .map(({ name }) => name)
              .compose(dropRepeats())}
            onChangeName={name => mesh.setLocalName(name)}
            deviceID={deviceID}
            onSelectDeviceID={onSelectDeviceID}
            localVolume={localVolume}
            onLocalVolumeChange={onLocalVolumeChange}
            disableAudio={disableAudio}
            onDisableAudio={onDisableAudio}
            onEnableAudio={onEnableAudio}
          />
        </aside>
        <div
          {...css({
            order: '0',
            flexGrow: '1',
            margin: '4em',
            marginLeft: '4em',
            marginRight: '4em',
          })}
        >
          <StudioRoomParticipants inviteURL={webURL} />
          <p>
            {ReactStream.render(
              mesh.localState
                .map(({ isMuted }) => isMuted)
                .compose(dropRepeats()),
              isMuted =>
                <button onClick={isMuted ? handleUnmute : handleMute}>
                  {isMuted ? 'Unmute' : 'Mute'}
                </button>,
            )}
          </p>
          <div
            {...css({
              width: '500px',
              height: '100px',
              backgroundColor: 'tomato',
            })}
          >
            {ReactStream.render(
              mesh.localAudio,
              node => node !== null && <AudioVisualization node={node} />,
            )}
          </div>
          {/*<div
            {...css({
              width: '50px',
              height: '200px',
              backgroundColor: 'black',
            })}
          >
            {ReactStream.render(
              mesh.localAudio,
              node =>
                node !== null &&
                <AudioPeakMeter context={audioContext} node={node} />,
            )}
          </div>*/}
          {webURL !== null &&
            <p>
              Invite guests to the recording:{' '}
              <code>{webURL}/?room={encodeURIComponent(mesh.roomName)}</code>
            </p>}
          {ReactStream.render(mesh.peers, peers =>
            <ul>
              {peers
                .map((peer, id) =>
                  <li key={id}>
                    <StudioPeer
                      peer={peer}
                      audioContext={audioContext}
                      disableAudio={disableAudio}
                    />
                  </li>,
                )
                .toArray()}
            </ul>,
          )}
        </div>
      </div>
    </div>
  );
}
