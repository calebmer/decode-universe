import * as React from 'react';
import { StudioRoom, ReactObservable } from '@decode/studio-ui';
import { HostPeersMesh } from './rtc/HostPeersMesh';

type Props = {
  mesh: HostPeersMesh,
  onNameChange: (name: string) => void,
  onUserAudioStream: (stream: MediaStream, previousStream: MediaStream | null) => void,
  onUserAudioError: (error: mixed, previousStream: MediaStream | null) => void,
  onStartRecording: () => void,
  onStopRecording: () => void,
  onExport: () => void,
};

export class App extends React.PureComponent<Props, {}> {
  private handleStartRecording = () => {
    this.props.onStartRecording();
  };

  private handleStopRecording = () => {
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
    return (
      <div>
        <p>
          {ReactObservable.render(
            mesh.recordingState,
            recordingState => (
              recordingState === HostPeersMesh.RecordingState.inactive ? (
                <span>
                  <button onClick={this.handleStartRecording}>
                    Start Recording
                  </button>
                  {' '}
                  <button onClick={this.handleExport}>
                    Export WAV
                  </button>
                </span>
              ) :
              recordingState === HostPeersMesh.RecordingState.starting ? (
                <span>Starting...</span>
              ) :
              recordingState === HostPeersMesh.RecordingState.recording ? (
                <button onClick={this.handleStopRecording}>
                  Stop Recording
                </button>
              ) : null
            )
          )}
        </p>
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
