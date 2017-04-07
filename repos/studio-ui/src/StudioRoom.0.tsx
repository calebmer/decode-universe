import * as React from 'react';
import { UserAudioDevices } from './audio/UserAudioDevices';
import { UserAudio } from './audio/UserAudio';
import { AudioVisualization } from './audio/AudioVisualization';
import { AudioDevicesSelect } from './audio/AudioDevicesSelect';

type State = {
  selectedInputDeviceID: string | null,
};

const lastSelectedInputDeviceIDKey =
  '@decode/studio-ui/lastSelectedInputDeviceIDKey';

export class StudioRoom extends React.Component<{}, State> {
  state: State = {
    selectedInputDeviceID: localStorage.getItem(lastSelectedInputDeviceIDKey),
  };

  handleSelectDevice = (deviceID: string) => {
    localStorage.setItem(lastSelectedInputDeviceIDKey, deviceID);
    this.setState({ selectedInputDeviceID: deviceID });
  };

  render() {
    const { selectedInputDeviceID } = this.state;
    return (
      <div>
        <p>
          Audio Input
          {' '}
          <UserAudioDevices render={({ inputDevices }, { reload }) => (
            <span>
              <AudioDevicesSelect
                devices={inputDevices}
                selectedDeviceID={selectedInputDeviceID}
                onSelectDevice={this.handleSelectDevice}
              />
              {' '}
              <button onClick={reload}>Reload</button>
            </span>
          )}/>
        </p>
        <UserAudio
          inputDeviceID={selectedInputDeviceID}
          render={audio => (
            audio.rejected ? (
              <div>Error!</div>
            ) : (
              <div style={{
                width: '500px',
                height: '100px',
                backgroundColor: 'tomato',
              }}>
                {!audio.loading && (
                  <AudioVisualization node={audio.source}/>
                )}
              </div>
            )
          )}
        />
      </div>
    );
  }
}