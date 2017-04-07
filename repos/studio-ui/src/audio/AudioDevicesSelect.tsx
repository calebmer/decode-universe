import * as React from 'react';

type Props = {
  devices: Array<MediaDeviceInfo>,
  selectedDeviceID: string | null,
  onSelectDevice: (deviceID: string) => void,
};

export class AudioDevicesSelect extends React.PureComponent<Props, {}> {
  handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    // Tell our parent that we got a new device id.
    this.props.onSelectDevice(event.target.value);
  };

  render() {
    const { devices, selectedDeviceID } = this.props;
    return (
      devices.length === 0 ? (
        <select/>
      ) : (
        <select
          value={
            // If we were not given a selected device then we need to guess
            // which device is selected.
            selectedDeviceID !== null
              ? selectedDeviceID
              : getDefaultDeviceID(devices)
          }
          onChange={this.handleChange}
        >
          {devices.map((device, i) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Device ${i + 1}`}
            </option>
          ))}
        </select>
      )
    );
  }
}

/**
 * Gets the device that most looks like the default from the array of devices
 * passed into the function.
 */
function getDefaultDeviceID(devices: Array<MediaDeviceInfo>): string | undefined {
  // If there are no devices then we need to return undefined.
  if (devices.length === 0) {
    return;
  }
  // Get the default device.
  const defaultDevice =
    // It appears that the default device id generally has an id of “default” in
    // Chrome.
    //
    // TODO: Is this behavior standard?
    devices.find(device => device.deviceId === 'default') ||
    // Just in case it is not then we select the first device.
    devices[0];
  // Return the default device’s id.
  return defaultDevice.deviceId;
}
