import * as React from 'react';

export type DevicesState = {
  readonly loading: true,
  readonly inputDevices: Array<MediaDeviceInfo>,
  readonly outputDevices: Array<MediaDeviceInfo>,
} | {
  readonly loading: false,
  readonly inputDevices: Array<MediaDeviceInfo>,
  readonly outputDevices: Array<MediaDeviceInfo>,
};

type Props = {
  render: (
    devices: DevicesState,
    actions: { reload: () => void },
  ) => JSX.Element | null,
};

type State = {
  devices: DevicesState,
};

/**
 * A constant so that if we set the state to loading while we are still loading
 * then the two loading states will be referentially equal and our component
 * will not update.
 */
const loadingDevices: DevicesState = {
  loading: true,
  inputDevices: [],
  outputDevices: [],
};

export class UserAudioDevices extends React.Component<Props, State> {
  state: State = {
    devices: loadingDevices,
  };

  componentDidMount() {
    this.tryToUpdateDevices();
  }

  /**
   * Asks the browser what the users devices are. If an error occurs when trying
   * to get the devices then we set the devices to empty arrays.
   */
  tryToUpdateDevices() {
    // Set our state to loading.
    this.setState({ devices: loadingDevices });

    navigator.mediaDevices.enumerateDevices().then(
      // If we got some devices back then update the state!
      (devices: Array<MediaDeviceInfo>) => {
        this.setState({
          devices: {
            loading: false,
            inputDevices:
              devices.filter(device => device.kind === 'audioinput'),
            outputDevices:
              devices.filter(device => device.kind === 'audiooutput'),
          },
        });
      },
      // We do not currently have an error state, so instead we just show an
      // empty device array.
      (error: any) => {
        console.error(error);
        this.setState({
          devices: {
            loading: false,
            inputDevices: [],
            outputDevices: [],
          },
        });
      },
    );
  }

  /**
   * The actions object that we pass into our child render function.
   */
  actions = {
    reload: () => {
      this.tryToUpdateDevices();
    },
  };

  render() {
    return this.props.render(this.state.devices, this.actions);
  }
}
