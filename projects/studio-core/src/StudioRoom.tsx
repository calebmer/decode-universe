import * as React from 'react';
import { Observable } from 'rxjs';
import { ReactObservable } from './observable/ReactObservable';
import { UserAudioDevicesSelect } from './audio/UserAudioDevicesSelect';
import { AudioVisualization } from './audio/AudioVisualization';
import { PeersMesh } from './rtc/PeersMesh';
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
}) {
  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    mesh.setLocalName(event.target.value);

  const handleMute = () => mesh.muteLocalAudio();
  const handleUnmute = () => mesh.unmuteLocalAudio();

  const handleLocalVolumeChange =
    (event: React.ChangeEvent<HTMLInputElement>) =>
      onLocalVolumeChange((parseInt(event.target.value, 10) || 0) / 100);

  return (
    <div>
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
      <p>
        Invite guests to the recording:{' '}
        <code>http://localhost:1999?room={encodeURIComponent(mesh.roomName)}</code>
      </p>
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
  )
}
