import * as React from 'react';
import { UserAudio } from './audio/UserAudio';
import { AudioVisualization } from './audio/AudioVisualization';

type State = {
  devices: Array<MediaDeviceInfo>,
  selectedInputDevice: MediaDeviceInfo | null,
};

export class StudioRoom extends React.Component<{}, State> {
  state: State = {
    devices: [],
    selectedInputDevice: null,
  };

  componentDidMount() {
    this.tryToUpdateDevices();
  }

  tryToUpdateDevices() {
    navigator.mediaDevices.enumerateDevices().then(
      (devices: Array<MediaDeviceInfo>) => {
        this.setState(previousState => {
          const nextState: Partial<State> = { devices };
          // If there was no previously selected device then we want to select
          // one from our `devices` array.
          if (previousState.selectedInputDevice === null) {
            // Get all our input devices.
            const inputDevices =
              devices.filter(device => device.kind === 'audioinput');
            // Select one of this input devices.
            nextState.selectedInputDevice =
              // First see if we can find the default device.
              inputDevices.find(device => device.deviceId === 'default') ||
              // If we can’t let’s just use the first input device.
              inputDevices[0] ||
              // If there is no first input device then we just want to set it
              // to null again.
              null;
          }
          return nextState;
        });
      },
      (error: any) => {
        console.error(error);
        this.setState({
          devices: [],
          selectedInputDevice: null,
        });
      },
    );
  }

  render() {
    const { devices, selectedInputDevice } = this.state;
    return (
      <div>
        <ul>
          <li>
            Audio Input
            <ul>
              {devices.map(device => (
                device.kind === 'audioinput' && (
                  <li key={device.deviceId}>
                    {device.label}
                  </li>
                )
              ))}
            </ul>
          </li>
          <li>
            Audio Output
            <ul>
              {devices.map(device => (
                device.kind === 'audiooutput' && (
                  <li key={device.deviceId}>
                    {device.label}
                  </li>
                )
              ))}
            </ul>
          </li>
        </ul>
        {selectedInputDevice !== null && (
          <UserAudio
            inputDevice={selectedInputDevice}
            render={userAudio => (
              userAudio.rejected ? (
                <div>Error!</div>
              ) : (
                <div>
                  <p>{userAudio.loading ? 'Loading…' : 'Yay!'}</p>
                  <div style={{
                    width: '500px',
                    height: '100px',
                    backgroundColor: 'tomato',
                  }}>
                    {!userAudio.loading && (
                      <AudioVisualization node={userAudio.source}/>
                    )}
                  </div>
                </div>
              )
            )}
          />
        )}
      </div>
    );
  }
}
