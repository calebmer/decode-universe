import * as React from 'react';
import { ReactObservable } from './shared/observable/ReactObservable';
import { UserAudioDevicesSelect } from './audio/UserAudioDevicesSelect';
import { UserAudioController } from './audio/UserAudioController';
import { AudioVisualization } from './audio/AudioVisualization';
import { PeersMesh } from './webrtc/PeersMesh';

type Props = {
  mesh: PeersMesh,
  onUserAudioStream: (stream: MediaStream) => void,
  onUserAudioError: (error: mixed) => void,
};

type State = {
  deviceID: string | null,
};

const audioContext = new AudioContext();

const selectedInputDeviceIDKey = '@decode/studio-ui/selectedInputDeviceID';

export class StudioRoom extends React.Component<Props, State> {
  state: State = {
    deviceID: localStorage.getItem(selectedInputDeviceIDKey),
  };

  handleSelectDeviceID = (deviceID: string) => {
    // Update the state with the new device id.
    this.setState({ deviceID });
    // Update local storage with the new information.
    localStorage.setItem(selectedInputDeviceIDKey, deviceID);
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
                  <p>{id}</p>
                  <div style={{
                    width: '500px',
                    height: '100px',
                    backgroundColor: 'tomato',
                  }}>
                    {ReactObservable.render(
                      peer!.remoteStreams,
                      remoteStreams => remoteStreams.size > 0 && (
                        <AudioVisualization
                          node={getMediaStreamSource(remoteStreams.first())}
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
