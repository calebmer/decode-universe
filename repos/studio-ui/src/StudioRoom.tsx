import * as React from 'react';
import { ReactObservable } from './observable/ReactObservable';
import { UserAudioDevicesSelect } from './audio/UserAudioDevicesSelect';
import { UserAudioController } from './audio/UserAudioController';
import { AudioVisualization } from './audio/AudioVisualization';
import { PeersMesh } from './rtc/PeersMesh';
import { PeerConnectionStatus } from './rtc/Peer';
import { StudioPeer } from './StudioPeer';

type Props = {
  mesh: PeersMesh,
  onNameChange: (name: string) => void,
  onUserAudioStream: (stream: MediaStream, previousStream: MediaStream | null) => void,
  onUserAudioError: (error: mixed, previousStream: MediaStream | null) => void,
};

type State = {
  deviceID: string | null,
};

const audioContext = new AudioContext();

const deviceIDKey = '@decode/studio-ui/deviceID';

export class StudioRoom extends React.Component<Props, State> {
  state: State = {
    deviceID: localStorage.getItem(deviceIDKey),
  };

  private handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.props.onNameChange(event.target.value);
  };

  private handleSelectDeviceID = (deviceID: string) => {
    // Update the state with the new device id.
    this.setState({ deviceID });
    // Update local storage with the new information.
    localStorage.setItem(deviceIDKey, deviceID);
  };

  private handleMute = () => {
    this.props.mesh.muteLocalStream();
  };

  private handleUnmute = () => {
    this.props.mesh.unmuteLocalStream();
  };

  render() {
    const { mesh, onUserAudioStream, onUserAudioError } = this.props;
    const { deviceID } = this.state;
    return (
      <div>
        <UserAudioController
          deviceID={deviceID}
          onStream={onUserAudioStream}
          onError={onUserAudioError}
        />
        <p>
          Name:{' '}
          {ReactObservable.render(
            mesh.localState.map(({ name }) => name).distinctUntilChanged(),
            name => (
              <input
                value={name}
                onChange={this.handleNameChange}
              />
            ),
          )}
        </p>
        <p>
          Audio Input:{' '}
          <UserAudioDevicesSelect
            kind="input"
            deviceID={deviceID}
            onSelect={this.handleSelectDeviceID}
          />
        </p>
        <p>
          {ReactObservable.render(
            mesh.localState
              .map(({ isMuted }) => isMuted)
              .distinctUntilChanged(),
            isMuted => (
              <button onClick={isMuted ? this.handleUnmute : this.handleMute}>
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
                  />
                </li>
              )).toArray()}
            </ul>
          ),
        )}
      </div>
    );
  }
}
