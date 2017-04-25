import * as React from 'react';
import { PeersMesh, StudioRoom } from '@decode/studio-ui';

type Props = {
  mesh: PeersMesh,
  onNameChange: (name: string) => void,
  onUserAudioStream: (stream: MediaStream, previousStream: MediaStream | null) => void,
  onUserAudioError: (error: mixed, previousStream: MediaStream | null) => void,
  onStartRecording: () => void,
  onStopRecording: () => void,
  onExport: () => void,
};

type State = {
  isRecording: boolean,
};

export class App extends React.Component<Props, State> {
  state: State = {
    isRecording: false,
  };

  private handleStartRecording = () => {
    this.setState({ isRecording: true });
    this.props.onStartRecording();
  };

  private handleStopRecording = () => {
    this.setState({ isRecording: false });
    this.props.onStopRecording();
  };

  private handleExport = () => {
    this.props.onExport();
  };

  render() {
    const {
      mesh,
      onNameChange,
      onUserAudioStream,
      onUserAudioError,
    } = this.props;
    const { isRecording } = this.state;
    return (
      <div>
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
          {' '}
          {!isRecording && (
            <button onClick={this.handleExport}>
              Export WAV
            </button>
          )}
        </div>
        <StudioRoom
          mesh={mesh}
          onNameChange={onNameChange}
          onUserAudioStream={onUserAudioStream}
          onUserAudioError={onUserAudioError}
        />
      </div>
    );
  }
}
