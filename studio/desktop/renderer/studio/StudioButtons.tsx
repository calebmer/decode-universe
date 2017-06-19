import * as React from 'react';
import { PeersMesh } from '~/studio/core/rtc/PeersMesh';
import { Storage } from '../shared/storage/Storage';
import { Recording } from './Recording';

export type Props = {
  storage: Storage;
  mesh: PeersMesh;
  onBack: () => void;
};

export type State = {
  recording: RecordingState;
};

export type RecordingState =
  | {
      readonly state: 'inactive';
    }
  | {
      readonly state: 'starting';
      readonly recording: Recording | null;
    }
  | {
      readonly state: 'recording';
      readonly recording: Recording;
    };

export class StudioButtons extends React.PureComponent<Props, State> {
  state: State = {
    recording: { state: 'inactive' },
  };

  componentWillUnmount() {
    // If we have a recording start timer then we need to clear it.
    if (this.recordingStartTimer !== null) {
      clearTimeout(this.recordingStartTimer);
    }
  }

  /**
   * The timer reference for when we should *actually* start recording. We add a
   * bit of artifical delay when starting a recording. This timer represents
   * that artificial delay. This delay allows us to ensure everyone is connected
   * and recording so the users don’t accidently start talking when the
   * recording has not started.
   */
  private recordingStartTimer: any = null;

  private startRecording = () => {
    // State check.
    if (this.state.recording.state !== 'inactive') {
      console.error(new Error('Can only start recording if inactive.'));
      return;
    }
    // Destructure props.
    const { storage, mesh } = this.props;
    // Switch into the loading state.
    this.setState({
      recording: {
        state: 'starting',
        recording: null,
      },
    });
    // Start a new recording in the given storage directory with the provided
    // mesh.
    Recording.start(storage.directory, mesh).then(
      recording => {
        // If the recording start timer is null (the timer finished) then we
        // want to update the state to the recording state with our new
        // recording instance.
        //
        // If the recording start timer is not null then we are still starting
        // and so we should add the recording, but we should not move out of the
        // `starting` state.
        if (this.recordingStartTimer === null) {
          this.setState({ recording: { state: 'recording', recording } });
        } else {
          this.setState({ recording: { state: 'starting', recording } });
        }
      },
      error => {
        // If we got an error then we need to report it.
        console.error(error);
        // Move our state back to an inactive state allowing users to try again
        // on starting their recording.
        this.setState({ recording: { state: 'inactive' } });
      },
    );
    // If we currently have a recording start timer then we need to clear it.
    if (this.recordingStartTimer !== null) {
      clearTimeout(this.recordingStartTimer);
    }
    // Set a timeout for the recording start timer.
    this.recordingStartTimer = setTimeout(() => {
      // We are done with the timer!
      this.recordingStartTimer = null;
      // Update the state based on the previous recording state.
      this.setState(({ recording }: State): Partial<State> | void => {
        // If the previous recording state was not starting, or we don’t
        // currently have a recording then cancel this state update.
        if (recording.state !== 'starting' || recording.recording === null) {
          return;
        }
        return {
          // Otherwise we want to update our state to recording with our
          // `Recording` instance.
          recording: {
            state: 'recording',
            recording: recording.recording,
          },
        };
      });
    }, 500);
  };

  private stopRecording = () => {
    const { recording } = this.state;
    // State check.
    if (recording.state !== 'recording') {
      console.error(
        new Error('Can only stop recording if currently recording.'),
      );
      return;
    }
    // If we currently have a recording start timer then we need to clear it.
    if (this.recordingStartTimer !== null) {
      clearTimeout(this.recordingStartTimer);
    }
    // Stop the recording.
    recording.recording.stop();
    // Move to an inactive state.
    this.setState({ recording: { state: 'inactive' } });
  };

  render() {
    const { onBack } = this.props;
    const { recording } = this.state;
    return (
      <p>
        {recording.state === 'inactive'
          ? <span>
              <button onClick={this.startRecording}>
                Start Recording
              </button>
              {' '}
              <button onClick={onBack}>
                Return to Recording Directory
              </button>
            </span>
          : recording.state === 'starting'
            ? <span>Starting...</span>
            : recording.state === 'recording'
              ? <button onClick={this.stopRecording}>
                  Stop Recording
                </button>
              : null}
      </p>
    );
  }
}
