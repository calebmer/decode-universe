import * as React from 'react';
import { UserAudioDevicesSelect } from './audio/UserAudioDevicesSelect';
import { UserAudioController } from './audio/UserAudioController';
import { AudioVisualization } from './audio/AudioVisualization';
import { PeerMeshController } from './webrtc/PeerMeshController';

type Props = {};

type State = {
  deviceID: string | null,
  userStream: MediaStream | null,
  connections: { [id: string]: RTCPeerConnection },
};

const audioContext = new AudioContext();

const selectedInputDeviceIDKey = '@decode/studio-ui/selectedInputDeviceID';

export class StudioRoom extends React.Component<Props, State> {
  state: State = {
    deviceID: localStorage.getItem(selectedInputDeviceIDKey),
    userStream: null,
    connections: {},
  };

  componentDidUpdate(previousProps: Props, previousState: State) {
    const nextState: State = this.state;
    // If the user’s stream changed in this update then let us go throw each
    // peer, remove the last stream, and add the new stream.
    if (previousState.userStream !== nextState.userStream) {
      for (const [, connection] of Object.entries(nextState.connections)) {
        // Remove the previous user stream if it was not null.
        if (previousState.userStream !== null) {
          connection.removeStream(previousState.userStream);
        }
        // Add the next user stream if it is not null.
        if (nextState.userStream !== null) {
          connection.addStream(nextState.userStream);
        }
      }
    }
  }

  handleSelectDeviceID = (deviceID: string) => {
    // Update the state with the new device id.
    this.setState({ deviceID });
    // Update local storage with the new information.
    localStorage.setItem(selectedInputDeviceIDKey, deviceID);
  };

  handleUserAudioStream = (stream: MediaStream) => {
    // Update the state with the new stream.
    this.setState({ userStream: stream });
  };

  handleUserAudioError = (error: mixed) => {
    // Remove the current user stream if there was an error.
    this.setState({ userStream: null });
    // Report the error.
    console.error(error);
  };

  handleAddConnection = (id: string, connection: RTCPeerConnection) => {
    // Add the new peer state to our component state.
    this.setState((previousState: State): Partial<State> => ({
      connections: {
        ...previousState.connections,
        [id]: connection,
      },
    }));
    // Add the user’s media stream to our peer if we have one. If we do not have
    // a stream then do nothing.
    {
      const { userStream } = this.state;
      if (userStream !== null) {
        connection.addStream(userStream);
      }
    }
  };

  handleRemoveConnection = (id: string) => {
    // Remove the old peer from our map.
    this.setState((previousState: State): Partial<State> => {
      // Use destructuring to get all of our peers except the peer with the id
      // we want to remove.
      const {
        [id]: removedConnection,
        ...nextConnections,
      } = previousState.connections;
      return {
        connections: nextConnections,
      };
    });
  };

  render() {
    const { deviceID, userStream } = this.state;
    return (
      <div>
        <UserAudioController
          deviceID={deviceID}
          onStream={this.handleUserAudioStream}
          onError={this.handleUserAudioError}
        />
        {/*<PeerMeshController
          roomName="hello world"
          onAddConnection={this.handleAddConnection}
          onRemoveConnection={this.handleRemoveConnection}
        />*/}
        <p>
          Audio Input:{' '}
          <UserAudioDevicesSelect
            kind="input"
            deviceID={deviceID}
            onSelect={this.handleSelectDeviceID}
          />
        </p>
        <div style={{
          width: '500px',
          height: '100px',
          backgroundColor: 'tomato',
        }}>
          {userStream !== null && (
            <AudioVisualization
              node={getMediaStreamSource(userStream)}
            />
          )}
        </div>
      </div>
    );
  }
}

// Temporary function to get caching some behaviors.
const cache = new WeakMap<MediaStream, MediaStreamAudioSourceNode>();
function getMediaStreamSource(stream: MediaStream): MediaStreamAudioSourceNode {
  if (!cache.has(stream)) {
    const source = audioContext.createMediaStreamSource(stream)
    cache.set(stream, source);
  }
  return cache.get(stream)!;
}
