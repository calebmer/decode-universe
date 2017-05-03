import * as React from 'react';

type Props = {
  deviceID: string | null,
  errorRetryMS?: number,
  onStream: (stream: MediaStream, previousStream: MediaStream | null) => void,
  onError: (error: mixed, previousStream: MediaStream | null) => void,
};

export class UserAudioController extends React.PureComponent<Props, {}> {
  componentDidMount() {
    this.tryToGetUserAudio();
  }

  componentDidUpdate(previousProps: Props) {
    const nextProps = this.props;
    // If the device id updated then we want to try to get a new user audio
    // `MediaStream` with the new device id.
    if (
      previousProps.deviceID !== nextProps.deviceID ||
      previousProps.errorRetryMS !== nextProps.errorRetryMS
    ) {
      this.tryToGetUserAudio();
    }
  }

  componentWillUnmount() {
    // If we were going to retry getting the user audio then cancel the retry.
    if (this.errorRetryTimer !== null) {
      clearTimeout(this.errorRetryTimer);
    }
  }

  // Used to “cancel” promises.
  private currentZoneID = 0;

  // The previous stream that we gave to the user.
  private previousStream: MediaStream | null = null;

  // A reference to the timer we use to retry getting the user audio.
  private errorRetryTimer: any = null;

  private tryToGetUserAudio() {
    // If we were going to retry getting the user audio then cancel the retry.
    if (this.errorRetryTimer !== null) {
      clearTimeout(this.errorRetryTimer);
    }
    const zoneID = this.currentZoneID += 1;
    const { deviceID, errorRetryMS, onStream, onError } = this.props;
    // Get user media. We only want audio so `video` is set to false.
    navigator.mediaDevices.getUserMedia({
      video: false,
      audio: {
        // Always try to cancel any echos on the line.
        echoCancelation: false,
        // If the device id is null then we want to use `undefined` (as if the
        // option were never set). Otherwise we want to use the device id we
        // were provided in props.
        deviceId: deviceID !== null ? deviceID : undefined,
      },
    }).then(
      // If we are in the same zone then report the new stream we have.
      stream => {
        if (zoneID === this.currentZoneID) {
          // Only proceed if the stream actually changed.
          if (stream !== this.previousStream) {
            onStream(stream, this.previousStream);
            this.previousStream = stream;
          }
        }
      },
      // If we are in the same zone then report the error we got.
      error => {
        if (zoneID === this.currentZoneID) {
          //
          onError(error, this.previousStream);
          // If we were told to retry getting the stream after some time had
          // passed then we want to do that.
          if (typeof errorRetryMS === 'number') {
            // If we were going to retry getting the user audio then cancel the
            // retry. This shouldn’t actually be necessary, but we really want
            // to override that timer.
            if (this.errorRetryTimer !== null) {
              clearTimeout(this.errorRetryTimer);
            }
            // Start a timer which will try to get the user audio after a
            // certain number of milliseconds.
            this.errorRetryTimer = setTimeout(() => {
              this.errorRetryTimer = null;
              this.tryToGetUserAudio();
            }, errorRetryMS);
          }
        }
      },
    );
  }

  render() {
    return null;
  }
}
