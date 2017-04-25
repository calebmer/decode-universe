import * as React from 'react';
import { ReactObservable } from './shared/observable/ReactObservable';
import { UserAudioDevicesSelect } from './audio/UserAudioDevicesSelect';
import { UserAudioController } from './audio/UserAudioController';
import { AudioVisualization } from './audio/AudioVisualization';
import { PeersMesh } from './rtc/PeersMesh';
import { PeerConnectionStatus } from './rtc/Peer';

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
    // name: localStorage.getItem(nameKey) || 'Guest',
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
            mesh.localStream,
            localStream => localStream !== null && (
              <AudioVisualization
                node={getMediaStreamSource(localStream)}
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
                  <p>
                    {ReactObservable.render(
                      peer.remoteState,
                      state => (
                        <span>
                          {state.name}
                          {state.isMuted === true && ' (muted)'}
                        </span>
                      ),
                    )}
                    {' '}
                    {ReactObservable.render(
                      peer.connectionStatus,
                      connectionStatus => (
                        <span>({PeerConnectionStatus[connectionStatus]})</span>
                      ),
                    )}
                  </p>
                  <div style={{
                    width: '500px',
                    height: '100px',
                    backgroundColor: 'tomato',
                  }}>
                    {ReactObservable.render(
                      peer.remoteStream,
                      remoteStream => remoteStream !== null && (
                        <AudioVisualization
                          node={getMediaStreamSource(remoteStream)}
                        />
                      ),
                    )}
                  </div>
                </li>
              )).toArray()}
            </ul>
          ),
        )}
      </div>
    );
  }
}

// Temporary function to get caching some behaviors.
const cache = new WeakMap<MediaStream, MediaStreamAudioSourceNode>();
function getMediaStreamSource(stream: MediaStream): MediaStreamAudioSourceNode {
  if (!cache.has(stream)) {
    const source = audioContext.createMediaStreamSource(stream)
    cache.set(stream, source);
  }
  return cache.get(stream)!;
}
