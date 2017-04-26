import * as React from 'react';
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
}: {
  mesh: PeersMesh,
  audioContext: AudioContext,
  deviceID: string | null,
  onSelectDeviceID: (deviceID: string) => void,
  disableAudio: boolean,
  onDisableAudio: () => void,
  onEnableAudio: () => void,
}) {
  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    mesh.setLocalName(event.target.value);

  const handleMute = () => mesh.muteLocalStream();
  const handleUnmute = () => mesh.unmuteLocalStream();

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
        <UserAudioDevicesSelect
          kind="input"
          deviceID={deviceID}
          onSelect={onSelectDeviceID}
        />
      </p>
      <p>
        <label>
          <input
            type="checkbox"
            checked={disableAudio}
            onChange={disableAudio ? onEnableAudio : onDisableAudio}
          />
          {' '}
          Disable Audio
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
          mesh.localStream
            .map(stream => stream !== null
              ? audioContext.createMediaStreamSource(stream)
              : null),
          source => source !== null && (
            <AudioVisualization
              node={source}
            />
          ),
        )}
      </div>
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
