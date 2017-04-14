import * as React from 'react';

type Props = {
  deviceID: string | null,
  onStream: (stream: MediaStream) => void,
  onError: (error: mixed) => void,
};

export class UserAudioController extends React.PureComponent<Props, {}> {
  componentDidMount() {
    this.tryToGetUserAudio();
  }

  componentDidUpdate(previousProps: Props) {
    const nextProps = this.props;
    // If the device id updated then we want to try to get a new user audio
    // `MediaStream` with the new device id.
    if (previousProps.deviceID !== nextProps.deviceID) {
      this.tryToGetUserAudio();
    }
  }

  // Used to “cancel” promises.
  private currentZoneID = 0;

  private tryToGetUserAudio() {
    const zoneID = this.currentZoneID += 1;
    const { deviceID, onStream, onError } = this.props;
    // Get user media. We only want audio so `video` is set to false.
    navigator.mediaDevices.getUserMedia({
      video: false,
      audio: {
        // Always try to cancel any echos on the line.
        echoCancelation: true,
        // If the device id is null then we want to use `undefined` (as if the
        // option were never set). Otherwise we want to use the device id we
        // were provided in props.
        deviceId: deviceID !== null ? deviceID : undefined,
      },
    }).then(
      // If we are in the same zone then report the new stream we have.
      stream => {
        if (zoneID === this.currentZoneID) {
          onStream(stream);
        }
      },
      // If we are in the same zone then report the error we got.
      error => {
        if (zoneID === this.currentZoneID) {
          onError(error);
        }
      },
    );
  }

  render() {
    return null;
  }
}
