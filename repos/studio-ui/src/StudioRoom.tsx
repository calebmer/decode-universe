import * as React from 'react';
import { UserAudioDevicesSelect } from './audio/UserAudioDevicesSelect';
import { UserAudioController } from './audio/UserAudioController';
import { AudioVisualization } from './audio/AudioVisualization';
import { PeersMeshController } from './webrtc/PeersMeshController';

type Props = {};

type State = {
  deviceID: string | null,
  userStream: MediaStream | null,
  peers: { [id: string]: PeerState },
};

type PeerState = {
  connection: RTCPeerConnection,
  streams: Array<MediaStream>,
};

const audioContext = new AudioContext();

const selectedInputDeviceIDKey = '@decode/studio-ui/selectedInputDeviceID';

export class StudioRoom extends React.Component<Props, State> {
  state: State = {
    deviceID: localStorage.getItem(selectedInputDeviceIDKey),
    userStream: null,
    peers: {},
  };

  componentDidUpdate(previousProps: Props, previousState: State) {
    const nextState: State = this.state;
    // If the user’s stream changed in this update then let us go throw each
    // peer, remove the last stream, and add the new stream.
    if (previousState.userStream !== nextState.userStream) {
      for (const [, { connection }] of Object.entries(nextState.peers)) {
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
      peers: {
        ...previousState.peers,
        [id]: {
          connection,
          streams: [],
        },
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
    // Every time our peer has a new stream available for us we need to take
    // that stream and use it to update our state.
    {
      connection.addEventListener('addstream', event => {
        // Extract the stream.
        const { stream } = event;
        // If the stream was null then return!
        if (stream === null) {
          return;
        }
        // Hack, but Chrome won't work without this. We never do anything with
        // this node, it's just a workaround.
        //
        // We took this from: https://github.com/mikeal/waudio/blob/2933809e05f840a4f34121e07f7e61633205906f/index.js#L9-L12
        // Followup issue: https://github.com/mikeal/waudio/issues/2
        {
          const node = new Audio();
          node.srcObject = stream;
        }
        // Update the state by immutably adding our new stream to the end of the
        // peer’s stream array.
        this.setState((previousState: State): Partial<State> => ({
          peers: {
            ...previousState.peers,
            [id]: {
              ...previousState.peers[id],
              streams: [...previousState.peers[id].streams, stream],
            },
          },
        }));
      });
    }
    // Whenever our peer wants to remove a stream we respect that request and
    // remove it from our peer state.
    {
      connection.addEventListener('removestream', event => {
        // Extract the stream.
        const { stream } = event;
        // If the stream was null then return!
        if (stream === null) {
          return;
        }
        // Immutably remove our stream from the streams array.
        this.setState((previousState: State): Partial<State> => ({
          peers: {
            ...previousState.peers,
            [id]: {
              ...previousState.peers[id],
              // Remove the stream using `filter` and a referential equality
              // check.
              streams: previousState.peers[id].streams.filter(
                previousStream => previousStream !== stream,
              ),
            },
          },
        }));
      });
    }
  };

  handleRemoveConnection = (id: string) => {
    // Remove the old peer from our map.
    this.setState((previousState: State): Partial<State> => {
      // Use destructuring to get all of our peers except the peer with the id
      // we want to remove.
      const {
        [id]: removedPeer,
        ...nextPeers,
      } = previousState.peers;
      return {
        peers: nextPeers,
      };
    });
  };

  render() {
    const { deviceID, userStream, peers } = this.state;
    return (
      <div>
        <UserAudioController
          deviceID={deviceID}
          onStream={this.handleUserAudioStream}
          onError={this.handleUserAudioError}
        />
        <PeersMeshController
          roomName="hello world"
          onAddConnection={this.handleAddConnection}
          onRemoveConnection={this.handleRemoveConnection}
        />
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
        <ul>
          {Object.entries(peers).map(([id, peer]) => (
            <li key={id}>
              <p>{id}</p>
              <div style={{
                width: '500px',
                height: '100px',
                backgroundColor: 'tomato',
              }}>
                {peer.streams.length > 0 && (
                  <AudioVisualization
                    node={getMediaStreamSource(peer.streams[0])}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
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
