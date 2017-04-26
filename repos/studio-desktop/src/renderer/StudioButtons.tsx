import * as React from 'react';
import * as fs from 'fs';
import { ReactObservable } from '@decode/studio-ui';
import { ExportRecording } from './rtc/audio/ExportRecording';
import { HostPeersMesh } from './rtc/HostPeersMesh';

type Props = {
  mesh: HostPeersMesh,
};

export class StudioButtons extends React.PureComponent<Props, {}> {
  private handleStartRecording = () => {
    const { mesh } = this.props;
    mesh.startRecording().catch(error => console.error(error));
  };

  private handleStopRecording = () => {
    const { mesh } = this.props;
    mesh.stopRecording().catch(error => console.error(error));
  };

  private handleExport = () => {
    const recordingsDirectory = '/Users/calebmer/Desktop/recordings';
    for (const name of fs.readdirSync(recordingsDirectory)) {
      if (name.startsWith('.')) {
        continue;
      }
      ExportRecording.exportWAV(`${recordingsDirectory}/${name}`)
        .catch(error => console.error(error));
    }
  };

  render() {
    const { mesh } = this.props;
    return (
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
    )
  }
}
