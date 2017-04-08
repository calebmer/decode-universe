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

const lastSelectedInputDeviceIDKey =
  '@decode/studio-ui/lastSelectedInputDeviceIDKey';

export class StudioRoom extends React.Component<{}, State> {
  state: State = {
    name: '',
    selectedInputDeviceID: localStorage.getItem(lastSelectedInputDeviceIDKey),
  };

  handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ name: event.target.value });
  };

  handleSelectDevice = (deviceID: string) => {
    localStorage.setItem(lastSelectedInputDeviceIDKey, deviceID);
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
            render={this.renderUserAudioDevices}
          />
        </p>
        <UserAudio
          inputDeviceID={selectedInputDeviceID}
          render={this.renderUserAudio}
        />
      </div>
    );
  }

  renderUserAudioDevices = (
    { inputDevices }: DevicesState,
    { reload }: { reload: () => void },
  ) => (
    <span>
      <AudioDevicesSelect
        devices={inputDevices}
        selectedDeviceID={this.state.selectedInputDeviceID}
        onSelectDevice={this.handleSelectDevice}
      />
      {' '}
      <button onClick={reload}>Reload</button>
    </span>
  );

  renderUserAudio = (audio: AudioState) => (
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
          stream={audio.stream || audio.previousStream}
          render={this.renderPeers}
        />
      </div>
    )
  );

  renderPeers = (peers: Array<Peer>) => (
    <ul>
      {peers.map(peer => (
        <li key={peer.id}>
          <p>{peer.id}</p>
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
  );
}
