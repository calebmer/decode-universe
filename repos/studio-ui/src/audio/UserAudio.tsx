import * as React from 'react';

type Data = {
  readonly loading: true,
  readonly rejected: false,
  readonly error: null,
  readonly context: null,
  readonly stream: null,
  readonly source: null,
} | {
  readonly loading: false,
  readonly rejected: true,
  readonly error: any,
  readonly context: null,
  readonly stream: null,
  readonly source: null,
} | {
  readonly loading: false,
  readonly rejected: false,
  readonly error: null,
  readonly context: AudioContext,
  readonly stream: MediaStream,
  readonly source: MediaStreamAudioSourceNode,
};

type Props = {
  inputDeviceID: string,
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
  context: null,
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

  componentDidMount() {
    this.tryToGetUserAudioNode();
  }

  componentDidUpdate(previousProps: Props, previousState: State) {
    const nextProps = this.props;
    const nextState = this.state;
    // Try to get the user media again if some of our props changed.
    if (previousProps.inputDeviceID !== nextProps.inputDeviceID) {
      this.tryToGetUserAudioNode();
    }
    // If our `AudioContext` instance changed then we need to close the old
    // `AudioContext` instance! This is because there is a hard limit on the
    // number of `AudioContext`s we can create for resource constraint reasons.
    // If we close the context then we are being a good citizen when it comes to
    // system resources.
    if (
      previousState.data.context !== null &&
      previousState.data.context !== nextState.data.context
    ) {
      previousState.data.context.close();
    }
  }

  /**
   * Runs the browser `getUserMedia` function to try and get a user’s audio
   * stream.
   */
  tryToGetUserAudioNode() {
    const { inputDeviceID } = this.props;

    // Set state to loading...
    this.setState({ data: loadingData });

    // Get user media. We only want audio so `video` is set to false.
    navigator.mediaDevices.getUserMedia({
      video: false,
      audio: {
        // Always try to cancel any echos on the line.
        echoCancelation: true,
        // Use the id from the device.
        deviceId: inputDeviceID,
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
            context,
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
            context: null,
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
