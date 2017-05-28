import * as React from 'react';
import { Observable } from 'rxjs';
import { css } from 'glamor';
import { Colors, Shadow } from '@decode/styles';
import { ReactObservable } from './observable/ReactObservable';
import { UserAudioDevicesSelect } from './audio/UserAudioDevicesSelect';
import { AudioVisualization } from './audio/AudioVisualization';
import { PeersMesh } from './rtc/PeersMesh';
import { StudioRoomHeader } from './StudioRoomHeader';
import { StudioRoomSidebar } from './StudioRoomSidebar';
import { StudioPeer } from './StudioPeer';

export function StudioRoom({
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
  mesh: PeersMesh,
  audioContext: AudioContext,
  deviceID: Observable<string | null>,
  onSelectDeviceID: (deviceID: string) => void,
  disableAudio: Observable<boolean>,
  onDisableAudio: () => void,
  onEnableAudio: () => void,
  localVolume: Observable<number>,
  onLocalVolumeChange: (localVolume: number) => void,
  webURL: string | null,
}) {
  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    mesh.setLocalName(event.target.value);

  const handleMute = () => mesh.muteLocalAudio();
  const handleUnmute = () => mesh.unmuteLocalAudio();

  const handleLocalVolumeChange =
    (event: React.ChangeEvent<HTMLInputElement>) =>
      onLocalVolumeChange((parseInt(event.target.value, 10) || 0) / 100);

  return (
    <div {...css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    })}>
      <header {...css(
        Shadow.createDropShadow(),
        { borderBottom: `1px solid ${Colors.geyserDarker}` },
      )}>
        <StudioRoomHeader/>
      </header>
      <div {...css({
        flexGrow: '1',
        display: 'flex',
      })}>
        <aside {...css(
          Shadow.createDropShadow(),
          Shadow.createInsetShadow({ top: true }),
          {
            order: '1',
            backgroundColor: Colors.geyser,
          },
        )}>
          <StudioRoomSidebar/>
        </aside>
        <div {...css({
          order: '0',
          flexGrow: '1',
          padding: '1px',
        })}>
          <p>
            Name:{' '}
            {ReactObservable.render(
              mesh.localState.map(({ name }) => name).distinctUntilChanged(),
              name => (
                <input
                  value={name}
                  onChange={handleNameChange}
                />
              ),
            )}
          </p>
          <p>
            Audio Input:{' '}
            {ReactObservable.render(
              deviceID,
              deviceID => (
                <UserAudioDevicesSelect
                  kind="input"
                  deviceID={deviceID}
                  onSelect={onSelectDeviceID}
                />
              ),
            )}
          </p>
          <p>
            Volume:{' '}
            {ReactObservable.render(
              localVolume,
              localVolume => (
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={localVolume * 100}
                  onChange={handleLocalVolumeChange}
                />
              ),
            )}
          </p>
          <p>
            <label>
              {ReactObservable.render(
                disableAudio,
                disableAudio => (
                  <input
                    type="checkbox"
                    checked={disableAudio}
                    onChange={disableAudio ? onEnableAudio : onDisableAudio}
                  />
                ),
              )}
              {' '}
              Disable Audio Output
            </label>
          </p>
          <p>
            {ReactObservable.render(
              mesh.localState
                .map(({ isMuted }) => isMuted)
                .distinctUntilChanged(),
              isMuted => (
                <button onClick={isMuted ? handleUnmute : handleMute}>
                  {isMuted ? 'Unmute' : 'Mute'}
                </button>
              ),
            )}
          </p>
          <div style={{
            width: '500px',
            height: '100px',
            backgroundColor: 'tomato',
          }}>
            {ReactObservable.render(
              mesh.localAudio,
              node => node !== null && (
                <AudioVisualization
                  node={node}
                />
              ),
            )}
          </div>
          {webURL !== null && (
            <p>
              Invite guests to the recording:{' '}
              <code>{webURL}/?room={encodeURIComponent(mesh.roomName)}</code>
            </p>
          )}
          {ReactObservable.render(
            mesh.peers,
            peers => (
              <ul>
                {peers.map((peer, id) => (
                  <li key={id}>
                    <StudioPeer
                      peer={peer}
                      audioContext={audioContext}
                      disableAudio={disableAudio}
                    />
                  </li>
                )).toArray()}
              </ul>
            ),
          )}
        </div>
      </div>
    </div>
  )
}
