import * as React from 'react';
import { UserAudioDevices } from './audio/UserAudioDevices';
import { UserAudio } from './audio/UserAudio';
import { AudioVisualization } from './audio/AudioVisualization';

type State = {
  selectedInputDeviceID: string | null,
};

export class StudioRoom extends React.Component<{}, State> {
  state: State = {
    selectedInputDeviceID: null,
  };

  render() {
    const { selectedInputDeviceID } = this.state;
    return (
      <div>
        <p>
          Audio Input{' '}
          <UserAudioDevices render={({ loading, inputDevices }) => (
            loading ? (
              // While we are loading we simply render an empty select box.
              <select/>
            ) : (
              // When we are finished loading we render the complete
              // select box. If we don’t have a selected input device then we
              // need to “guess” one from our input devices.
              <select
                value={
                  selectedInputDeviceID === null
                    ? inputDevices[0].deviceId
                    : selectedInputDeviceID
                }
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
            )
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
