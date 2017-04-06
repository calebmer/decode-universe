import * as React from 'react';

type Data =
  { loading: true, rejected: false } |
  { loading: false, rejected: true, error: any } |
  { loading: false, rejected: false, stream: MediaStream, source: MediaStreamAudioSourceNode };

type Props = {
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
    // Set state to loading...
    this.setState({ data: loadingData });

    // Get user media. We only want audio so `video` is set to false.
    navigator.mediaDevices.getUserMedia({
      video: false,
      audio: {
        echoCancelation: true,
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
