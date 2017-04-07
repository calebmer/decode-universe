import * as React from 'react';

type AudioState = {
  readonly loading: true,
  readonly rejected: false,
  readonly error: null,
  readonly stream: null,
  readonly previousStream: MediaStream | null,
} | {
  readonly loading: false,
  readonly rejected: true,
  readonly error: any,
  readonly stream: null,
  readonly previousStream: null,
} | {
  readonly loading: false,
  readonly rejected: false,
  readonly error: null,
  readonly stream: MediaStream,
  readonly previousStream: null,
};

type Props = {
  inputDeviceID?: string | null,
  render: (audio: AudioState) => JSX.Element | null,
};

type State = {
  audio: AudioState,
};

/**
 * Gets an audio source object for the current user’s browser with
 * `getUserMedia`.
 */
export class UserAudio extends React.PureComponent<Props, State> {
  state: State = {
    audio: {
      loading: true,
      rejected: false,
      error: null,
      stream: null,
      previousStream: null,
    },
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

    // Set state to loading if we are not currently loading.
    this.setState((previousState: State): Partial<State> => {
      // If we are currently loading then update nothing.
      if (previousState.audio.loading === true) {
        return {};
      }
      return {
        audio: {
          loading: true,
          rejected: false,
          error: null,
          stream: null,
          // Set the previous stream to whatever the stream was in the
          // previous state.
          previousStream: previousState.audio.stream,
        },
      };
    });

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
            previousStream: null,
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
            previousStream: null,
          },
        });
      },
    )
  }

  render () {
    return this.props.render(this.state.audio);
  }
}
