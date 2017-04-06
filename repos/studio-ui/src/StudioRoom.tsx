import * as React from 'react';
import { UserAudio } from './audio/UserAudio';
import { AudioVisualization } from './audio/AudioVisualization';

type State = {
  inputDevices: Array<MediaDeviceInfo>,
  outputDevices: Array<MediaDeviceInfo>,
  selectedInputDeviceID: string | null,
};

export class StudioRoom extends React.Component<{}, State> {
  state: State = {
    inputDevices: [],
    outputDevices: [],
    selectedInputDeviceID: null,
  };

  componentDidMount() {
    this.tryToUpdateDevices();
  }

  tryToUpdateDevices() {
    navigator.mediaDevices.enumerateDevices().then(
      (devices: Array<MediaDeviceInfo>) => {
        this.setState(previousState => {
          // Construct the input and output devices.
          const inputDevices =
            devices.filter(device => device.kind === 'audioinput');
          const outputDevices =
            devices.filter(device => device.kind === 'audiooutput');
          // Create the initial next state.
          const nextState: Partial<State> = {
            inputDevices,
            outputDevices,
          };
          // If there was no previously selected device then we want to select
          // one from our `devices` array.
          if (previousState.selectedInputDeviceID === null) {
            // Select one of this input devices.
            const selectedInputDevice =
              // First see if we can find the default device.
              inputDevices.find(device => device.deviceId === 'default') ||
              // If we can’t let’s just use the first input device.
              inputDevices[0] ||
              // If there is no first input device then we just want to set it
              // to null again.
              null;
            // Set that device’s id to state.
            nextState.selectedInputDeviceID =
              selectedInputDevice && selectedInputDevice.deviceId;
          }
          return nextState;
        });
      },
      (error: any) => {
        console.error(error);
        this.setState({
          inputDevices: [],
          outputDevices: [],
          selectedInputDeviceID: null,
        });
      },
    );
  }

  render() {
    const { inputDevices, selectedInputDeviceID } = this.state;
    return (
      <div>
        <div>
          Audio Input{' '}
          {selectedInputDeviceID !== null && (
            <select
              value={selectedInputDeviceID}
              onChange={event => {
                this.setState({ selectedInputDeviceID: event.target.value })
              }}
            >
              {inputDevices.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
          )}
        </div>
        {selectedInputDeviceID !== null && (
          <UserAudio
            inputDeviceID={selectedInputDeviceID}
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
