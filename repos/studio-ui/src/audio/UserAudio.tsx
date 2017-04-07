import * as React from 'react';

type AudioState = {
  readonly loading: true,
  readonly rejected: false,
  readonly error: null,
  readonly stream: null,
} | {
  readonly loading: false,
  readonly rejected: true,
  readonly error: any,
  readonly stream: null,
} | {
  readonly loading: false,
  readonly rejected: false,
  readonly error: null,
  readonly stream: MediaStream,
};

type Props = {
  inputDeviceID?: string | null,
  render: (audio: AudioState) => JSX.Element | null,
};

type State = {
  audio: AudioState,
};

/**
 * We use a single instance of loading data so that if we are loading and we set
 * the state to loading again then the component won’t update because the
 * loading states will be referentially equal.
 */
const loadingAudio: AudioState = {
  loading: true,
  rejected: false,
  error: null,
  stream: null,
};

/**
 * Gets an audio source object for the current user’s browser with
 * `getUserMedia`.
 */
export class UserAudio extends React.PureComponent<Props, State> {
  state: State = {
    audio: loadingAudio,
  };

  componentDidMount() {
    this.tryToGetUserAudioNode();
  }

  componentDidUpdate(previousProps: Props) {
    const nextProps = this.props;
    // Try to get the user media again if some of our props changed.
    if (previousProps.inputDeviceID !== nextProps.inputDeviceID) {
      this.tryToGetUserAudioNode();
    }
  }

  /**
   * Runs the browser `getUserMedia` function to try and get a user’s audio
   * stream.
   */
  tryToGetUserAudioNode() {
    const { inputDeviceID } = this.props;

    // Set state to loading...
    this.setState({ audio: loadingAudio });

    // Get user media. We only want audio so `video` is set to false.
    navigator.mediaDevices.getUserMedia({
      video: false,
      audio: {
        // Always try to cancel any echos on the line.
        echoCancelation: true,
        // Use the id from the device. If it is null then we want to set
        // the value to undefined instead.
        deviceId: inputDeviceID !== null ? inputDeviceID : undefined,
      },
    }).then(
      // Update our state with the new stream. We also create a new
      // `AudioContext` and create an `AudioNode` for this media stream.
      stream => {
        this.setState({
          audio: {
            loading: false,
            rejected: false,
            error: null,
            stream,
          },
        });
      },
      // Otherwise, handle the error. The user probably did not give us
      // audio permissions.
      error => {
        console.error(error);
        this.setState({
          audio: {
            loading: false,
            rejected: true,
            error,
            stream: null,
          },
        });
      },
    )
  }

  render () {
    return this.props.render(this.state.audio);
  }
}
