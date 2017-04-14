import * as React from 'react';
import { PeersMesh, StudioRoom } from '@decode/studio-ui';

type Props = {
  mesh: PeersMesh,
  onUserAudioStream: (stream: MediaStream) => void,
  onUserAudioError: (error: mixed) => void,
};

type State = {
  isRecording: boolean,
};

export class App extends React.Component<Props, State> {
  state: State = {
    isRecording: false,
  };

  handleStartRecording = () => {
    this.setState({
      isRecording: true,
    });
  };

  handleStopRecording = () => {
    this.setState({
      isRecording: false,
    });
  };

  render() {
    const { mesh, onUserAudioStream, onUserAudioError } = this.props;
    const { isRecording } = this.state;
    return (
      <div>
        <button
          onClick={
            isRecording
              ? this.handleStopRecording
              : this.handleStartRecording
          }
        >
          {isRecording ? 'Stop' : 'Start'} Recording
        </button>
        <StudioRoom
          mesh={mesh}
          onUserAudioStream={onUserAudioStream}
          onUserAudioError={onUserAudioError}
        />
      </div>
    );
  }
}
