import * as React from 'react';
import { SelectInput } from '../shared/input/SelectInput';

type Props = {
  kind: 'input' | 'output';
  deviceID: string | null;
  onSelect: (deviceID: string) => void;
};

type State = {
  devices: Array<MediaDeviceInfo>;
};

/**
 * We want to check for new devices every so often. We only expect this
 * component to be rendered on a screen when a user has an options menu open, so
 * it can be semi-frequentish without worrying that performance will die.
 */
const devicesPollingMs = 1000;

export class UserAudioDevicesSelect extends React.Component<Props, State> {
  state: State = {
    devices: [],
  };

  componentDidMount() {
    // Update our devices and start a polling operation to keep the devices
    // list updated.
    this.updateDevices();
  }

  shouldComponentUpdate(nextProps: Props, nextState: State) {
    const previousProps = this.props;
    const previousState = this.state;
    return (
      previousProps.kind !== nextProps.kind ||
      previousProps.deviceID !== nextProps.deviceID ||
      previousProps.onSelect !== nextProps.onSelect ||
      // We want a custom check for the devices arrays.
      !areDevicesEqual(previousState.devices, nextState.devices)
    );
  }

  componentDidUpdate(previousProps: Props) {
    const nextProps = this.props;
    // If the `kind` prop changed then we want to cancel any scheduled
    // `updateDevices()` calls and immeadiately call the method.
    if (previousProps.kind !== nextProps.kind) {
      this.updateDevices();
    }
  }

  componentWillUnmount() {
    // Cancel any timeouts that may be running.
    this.cancelScheduledUpdateDevices();
  }

  /**
   * The timeout we will use for scheduling calls to `updateDevices()`.
   */
  private nextUpdateDevicesTimeout: any = null;

  /**
   * Cancels a scheduled `updateDevices()` call. If no `updateDevices()` call is
   * scheduled then calling this is a noop.
   */
  private cancelScheduledUpdateDevices() {
    // If there is a timeout currently running we should cancel it so that we
    // can update devices *now*.
    if (this.nextUpdateDevicesTimeout !== null) {
      clearTimeout(this.nextUpdateDevicesTimeout);
    }
  }

  /**
   * Schedules a call to `updateDevices()` later.
   */
  private scheduleUpdateDevices() {
    // Set the timeout.
    this.nextUpdateDevicesTimeout = setTimeout(() => {
      // Remove the timeout.
      this.nextUpdateDevicesTimeout = null;
      // Call the function again.
      this.updateDevices();
    }, devicesPollingMs);
  }

  /**
   * Used to “cancel” promises. If another zone is created while a promise is
   * executing we should not use its results.
   */
  private currentZoneID = 0;

  /**
   * Tries to query the user’s device by calling `mediaDevices.enumerateDevices`
   * and then schedules another call to `updateDevices()` to create a polling
   * behavior.
   */
  private updateDevices() {
    // Get a zone id.
    const zoneID = (this.currentZoneID += 1);
    // Cancel any timeouts that may be running.
    this.cancelScheduledUpdateDevices();
    // Try to enumerate the user’s devices.
    navigator.mediaDevices.enumerateDevices().then(
      // If we got some devices back then update the state!
      (devices: Array<MediaDeviceInfo>) => {
        // If a new zone was created then this zone is invalid and we should not
        // process the results of this promise.
        if (zoneID !== this.currentZoneID) {
          return;
        }
        const { kind } = this.props;
        this.setState({
          // Filter the devices by our props.
          devices: devices.filter(device => {
            switch (kind) {
              case 'input':
                return device.kind === 'audioinput';
              case 'output':
                return device.kind === 'audiooutput';
            }
          }),
        });
        // Schedule another call to this function.
        this.scheduleUpdateDevices();
      },
      // We do not currently have an error state, so instead we just show an
      // empty device array.
      (error: any) => {
        // If a new zone was created then this zone is invalid and we should not
        // process the results of this promise.
        if (zoneID !== this.currentZoneID) {
          return;
        }
        // Make our devices array empty.
        this.setState({ devices: [] });
        // Report the error in the console.
        console.error(error);
        // Schedule another call to this function.
        this.scheduleUpdateDevices();
      },
    );
  }

  private handleChange = (value: string) => this.props.onSelect(value);

  render() {
    const { deviceID } = this.props;
    const { devices } = this.state;
    // If we were not given a selected device then we need to guess
    // which device is selected.
    const actualDeviceID = deviceID !== null
      ? deviceID
      : getDefaultDeviceID(devices);
    // Render the `<SelectInput>`, but only if we have the appropriate
    // information. Otherwise render null.
    return !actualDeviceID || devices.length === 0
      ? null
      : <SelectInput
          label="Audio Input"
          value={actualDeviceID}
          options={devices.map((device, i) => ({
            value: device.deviceId,
            label: device.label || `Device ${i + 1}`,
          }))}
          onChange={this.handleChange}
        />;
  }
}

/**
 * A quick check to determine whether or not the devices arrays are different.
 */
function areDevicesEqual(
  previousDevices: Array<MediaDeviceInfo>,
  nextDevices: Array<MediaDeviceInfo>,
): boolean {
  if (previousDevices.length !== nextDevices.length) {
    return false;
  }
  for (let i = 0; i < previousDevices.length; i++) {
    const previousDevice = previousDevices[i];
    const nextDevice = nextDevices[i];
    if (previousDevice === nextDevice) {
      continue;
    }
    if (
      previousDevice.deviceId !== nextDevice.deviceId ||
      previousDevice.label !== nextDevice.label
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Gets the device that most looks like the default from the array of devices
 * passed into the function.
 *
 * We only use this to find something to display when the selected device id is
 * `null`.
 */
function getDefaultDeviceID(
  devices: Array<MediaDeviceInfo>,
): string | undefined {
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
