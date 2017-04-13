import * as React from 'react';
import { StudioRoom } from '@decode/studio-ui/StudioRoom';

type State = {
  isRecording: boolean,
};

export class App extends React.Component<{}, State> {
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
        <StudioRoom/>
      </div>
    );
  }
}
