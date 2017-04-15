import * as React from 'react';
import { PeersMesh, StudioRoom } from '@decode/studio-ui';

type Props = {
  mesh: PeersMesh,
  onUserAudioStream: (stream: MediaStream, previousStream: MediaStream | null) => void,
  onUserAudioError: (error: mixed) => void,
  onStartRecording: () => void,
  onStopRecording: () => void,
};

type State = {
  isRecording: boolean,
};

export class App extends React.Component<Props, State> {
  state: State = {
    isRecording: false,
  };

  handleStartRecording = () => {
    this.setState({ isRecording: true });
    this.props.onStartRecording();
  };

  handleStopRecording = () => {
    this.setState({ isRecording: false });
    this.props.onStopRecording();
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
