import * as React from 'react';
import { Observable } from 'rxjs';
import { css } from 'glamor';
import { ReactObservable } from './observable/ReactObservable';
import { AudioVisualization } from './audio/AudioVisualization';
import { PeersMesh } from './rtc/PeersMesh';
import { StudioRoomHeader } from './StudioRoomHeader';
import { StudioRoomOptionsPanel } from './StudioRoomOptionsPanel';
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
  const handleMute = () => mesh.muteLocalAudio();
  const handleUnmute = () => mesh.unmuteLocalAudio();

  return (
    <div {...css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    })}>
      <header>
        <StudioRoomHeader/>
      </header>
      <div {...css({
        flexGrow: '1',
        display: 'flex',
      })}>
        <aside {...css({
          order: '1',
          overflow: 'scroll',
          padding: '2em',
        })}>
          <StudioRoomOptionsPanel
            name={mesh.localState.map(({ name }) => name).distinctUntilChanged()}
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
        <div {...css({
          order: '0',
          flexGrow: '1',
          padding: '1px',
        })}>
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
