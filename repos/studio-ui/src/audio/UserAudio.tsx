import * as React from 'react';

type Data = {
  readonly loading: true,
  readonly rejected: false,
  readonly error: null,
  readonly stream: null,
  readonly source: null,
} | {
  readonly loading: false,
  readonly rejected: true,
  readonly error: any,
  readonly stream: null,
  readonly source: null,
} | {
  readonly loading: false,
  readonly rejected: false,
  readonly error: null,
  readonly stream: MediaStream,
  readonly source: MediaStreamAudioSourceNode,
};

type Props = {
  inputDevice: MediaDeviceInfo,
  render: (data: Data) => JSX.Element | null,
};

type State = {
  data: Data,
};

/**
 * We use a single instance of loading data so that if we are loading and we set
 * the state to loading again then the component won’t update because the
 * loading states will be referentially equal.
 */
const loadingData: Data = {
  loading: true,
  rejected: false,
  error: null,
  stream: null,
  source: null,
};

/**
 * Gets an audio source object for the current user’s browser with
 * `getUserMedia`.
 */
export class UserAudio extends React.PureComponent<Props, State> {
  state: State = {
    data: loadingData,
  };

  componentDidMount () {
    this.tryToGetUserAudioNode();
  }

  /**
   * Runs the browser `getUserMedia` function to try and get a user’s audio
   * stream.
   */
  tryToGetUserAudioNode () {
    const { inputDevice } = this.props;

    // Set state to loading...
    this.setState({ data: loadingData });

    // Get user media. We only want audio so `video` is set to false.
    navigator.mediaDevices.getUserMedia({
      video: false,
      audio: {
        // Always try to cancel any echos on the line.
        echoCancelation: true,
        // Use the id from the device.
        deviceId: inputDevice.deviceId,
      },
    }).then(
      // Update our state with the new stream. We also create a new
      // `AudioContext` and create an `AudioNode` for this media stream.
      stream => {
        const context = new AudioContext();
        const source = context.createMediaStreamSource(stream);
        this.setState({
          data: {
            loading: false,
            rejected: false,
            error: null,
            stream,
            source,
          },
        })
      },
      // Otherwise, handle the error. The user probably did not give us
      // audio permissions.
      error => {
        console.error(error);
        this.setState({
          data: {
            loading: false,
            rejected: true,
            error,
            stream: null,
            source: null,
          },
        });
      },
    )
  }

  render () {
    const { render } = this.props;
    const { data } = this.state;
    return render(data);
  }
}
