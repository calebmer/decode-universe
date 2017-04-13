import * as React from 'react';

type Props = {
  onStream: (stream: MediaStream) => void,
  onError: (error: mixed) => void,
};

export class UserAudioController extends React.PureComponent<Props, {}> {
  componentDidMount() {
    this.tryToGetUserAudio();
  }

  // Used to “cancel” promises.
  private currentZoneID = 0;

  private tryToGetUserAudio() {
    const zoneID = this.currentZoneID++;
    const { onStream, onError } = this.props;
    // Get user media. We only want audio so `video` is set to false.
    navigator.mediaDevices.getUserMedia({
      video: false,
      audio: {
        // Always try to cancel any echos on the line.
        echoCancelation: true,
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
