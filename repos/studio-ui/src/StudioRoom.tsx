import * as React from 'react';
import { ReactObservable } from './shared/observable/ReactObservable';
import { UserAudioDevicesSelect } from './audio/UserAudioDevicesSelect';
import { UserAudioController } from './audio/UserAudioController';
import { AudioVisualization } from './audio/AudioVisualization';
import { PeersMesh } from './rtc/PeersMesh';
import { PeerConnectionStatus } from './rtc/Peer';

type Props = {
  mesh: PeersMesh,
  onUserAudioStream: (stream: MediaStream, previousStream: MediaStream | null) => void,
  onUserAudioError: (error: mixed, previousStream: MediaStream | null) => void,
};

type State = {
  name: string,
  deviceID: string | null,
};

const audioContext = new AudioContext();

const nameKey = '@decode/studio-ui/name';
const deviceIDKey = '@decode/studio-ui/deviceID';

export class StudioRoom extends React.Component<Props, State> {
  state: State = {
    name: localStorage.getItem(nameKey) || 'Guest',
    deviceID: localStorage.getItem(deviceIDKey),
  };

  componentDidMount() {
    this.props.mesh.updateLocalState({ name: this.state.name });
  }

  handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const name = event.target.value;
    // Update the state with the new name.
    this.setState({ name });
    // Update the local state in the mesh with the new name.
    this.props.mesh.updateLocalState({ name });
    // Update local storage with the new information.
    localStorage.setItem(nameKey, name);
  };

  handleSelectDeviceID = (deviceID: string) => {
    // Update the state with the new device id.
    this.setState({ deviceID });
    // Update local storage with the new information.
    localStorage.setItem(deviceIDKey, deviceID);
  };

  render() {
    const { mesh, onUserAudioStream, onUserAudioError } = this.props;
    const { name, deviceID } = this.state;
    return (
      <div>
        <UserAudioController
          deviceID={deviceID}
          onStream={onUserAudioStream}
          onError={onUserAudioError}
        />
        <p>
          Name:{' '}
          <input
            value={name}
            onChange={this.handleNameChange}
          />
        </p>
        <p>
          Audio Input:{' '}
          <UserAudioDevicesSelect
            kind="input"
            deviceID={deviceID}
            onSelect={this.handleSelectDeviceID}
          />
        </p>
        <div style={{
          width: '500px',
          height: '100px',
          backgroundColor: 'tomato',
        }}>
          {ReactObservable.render(
            mesh.localStreams,
            localStreams => localStreams.size > 0 && (
              <AudioVisualization
                node={getMediaStreamSource(localStreams.first())}
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
                      peer!.remoteState,
                      state => (
                        <span>{state.name}</span>
                      ),
                    )}
                    {' '}
                    {ReactObservable.render(
                      peer!.connectionStatus,
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
                      peer!.remoteStreams,
                      streams => streams.size > 0 && (
                        <AudioVisualization
                          node={getMediaStreamSource(streams.first())}
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
