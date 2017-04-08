import * as React from 'react';
import { UserAudioDevices, DevicesState } from './audio/UserAudioDevices';
import { UserAudio, AudioState } from './audio/UserAudio';
import { AudioVisualization } from './audio/AudioVisualization';
import { AudioDevicesSelect } from './audio/AudioDevicesSelect';
import { PeerMesh, Peer } from './webrtc/PeerMesh';

type State = {
  name: string,
  selectedInputDeviceID: string | null,
};

const audioContext = new AudioContext();

const nameKey = '@decode/studio-ui/name';
const selectedInputDeviceIDKey = '@decode/studio-ui/selectedInputDeviceID';

export class StudioRoom extends React.Component<{}, State> {
  state: State = {
    name: localStorage.getItem(nameKey) || '',
    selectedInputDeviceID: localStorage.getItem(selectedInputDeviceIDKey),
  };

  handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const name = event.target.value;
    localStorage.setItem(nameKey, name);
    this.setState({ name });
  };

  handleSelectDevice = (deviceID: string) => {
    localStorage.setItem(selectedInputDeviceIDKey, deviceID);
    this.setState({ selectedInputDeviceID: deviceID });
  };

  render() {
    const { name, selectedInputDeviceID } = this.state;
    return (
      <div>
        <p>
          Name:{' '}
          <input
            value={name}
            onChange={this.handleNameChange}
          />
        </p>
        <p>
          Audio Input:{' '}
          <UserAudioDevices
            render={({ inputDevices }, { reload }) => (
              <span>
                <AudioDevicesSelect
                  devices={inputDevices}
                  selectedDeviceID={this.state.selectedInputDeviceID}
                  onSelectDevice={this.handleSelectDevice}
                />
                {' '}
                <button onClick={reload}>Reload</button>
              </span>
            )}
          />
        </p>
        <UserAudio
          inputDeviceID={selectedInputDeviceID}
          render={audio => (
            audio.rejected ? (
              <div>Error!</div>
            ) : (
              <div>
                <div style={{
                  width: '500px',
                  height: '100px',
                  backgroundColor: 'tomato',
                }}>
                  {!audio.loading && (
                    <AudioVisualization
                      node={audioContext.createMediaStreamSource(audio.stream)}
                    />
                  )}
                </div>
                <PeerMesh
                  roomName="hello world"
                  data={{ name: this.state.name || null }}
                  stream={audio.stream || audio.previousStream}
                  render={(peers: Array<Peer>) => (
                    <ul>
                      {peers.map(peer => (
                        <li key={peer.id}>
                          <p>{peer.data.name || 'Guest'}</p>
                          <div style={{
                            width: '500px',
                            height: '100px',
                            backgroundColor: 'tomato',
                          }}>
                            {peer.stream !== null && (
                              <AudioVisualization
                                node={audioContext.createMediaStreamSource(peer.stream)}
                              />
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                />
              </div>
            )
          )}
        />
      </div>
    );
  }
}
