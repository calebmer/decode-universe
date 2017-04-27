import * as React from 'react';
import { Subscription } from 'rxjs';
import { UserAudioController } from './audio/UserAudioController';
import { PeersMesh } from './rtc/PeersMesh';
import { Peer } from './rtc/Peer';
import { StudioRoom } from './StudioRoom';
import { StudioUserAudioNotAllowed } from './StudioUserAudioNotAllowed';
import { StudioUserAudioNotFound } from './StudioUserAudioNotFound';

const audioContext = new AudioContext();

const deviceIDKey = '@decode/studio-ui/deviceID';
const nameKey = '@decode/studio-ui/name';

/**
 * Creates a `<StudioRoomController/>` component with some of the provided
 * configuration options.
 *
 * We need to provide configuration options because the
 * `<StudioRoomController/>` component is used in both the desktop and the web
 * Decode Studio clients. These two clients have different semantics. These
 * options are where the semantics may be injected.
 */
const createComponent = <TPeersMesh extends PeersMesh<TPeer> = PeersMesh<TPeer>, TPeer extends Peer = Peer>({
  createPeersMesh: userCreatePeersMesh,
  renderButtons,
}: {

  // Called when the component wants to create a new `PeersMesh` instance.
  createPeersMesh: (options: {
    roomName: string,
    localAudioContext: AudioContext,
    previousLocalName: string | null,
  }) => TPeersMesh,

  // Renders some buttons at the top of the studio room UI.
  renderButtons?: (options: {
    mesh: TPeersMesh,
  }) => JSX.Element,

}) => {
  type Props = {
    roomName: string,
  };

  type State = {
    userAudio: UserAudioState,
    mesh: TPeersMesh | null,
    deviceID: string | null,
    disableAudio: boolean,
  };

  type UserAudioState = {
    state: 'loading',
  } | {
    state: 'error',
    error: any,
  } | {
    state: 'success',
    // A tuple of the audio nodes we use in the order which they are connected.
    // We will send the last node to our mesh.
    nodes: [
      // The source of our audio from a `MediaStream` received from
      // `getUserMedia()`.
      MediaStreamAudioSourceNode,
      // A dynamics compressor which will improve the quality of our audio in
      // general.
      DynamicsCompressorNode,
      // A node which will allow us to adjust the volume of the output audio.
      //
      // **NOTE:** If the user wants to mute their audio they unset any local
      // streams instead of setting the volume to 0 on this gain node. This
      // ensures security as there is no chance any audio will be streamed to
      // the other peers. It also allows us to render a muted state for our
      // peers.
      GainNode
    ],
  };

  function createPeersMesh({ roomName }: Props): TPeersMesh {
    return userCreatePeersMesh({
      roomName,
      localAudioContext: audioContext,
      previousLocalName: localStorage.getItem(nameKey),
    });
  }

  return class StudioRoomController extends React.Component<Props, State> {
    state: State = {
      userAudio: { state: 'loading' },
      mesh: null,
      deviceID: localStorage.getItem(deviceIDKey),
      disableAudio: DEV,
    };

    /**
     * We want to subscribe to our mesh’s local state so that whenever the name
     * changes we can store the new name in local storage. This is the
     * subscription for that operation. `null` if we have no such operation
     * running.
     */
    private nameSubscription: Subscription | null = null;

    componentWillReceiveProps(nextProps: Props) {
      const previousProps = this.props;
      // If the room name changed and we have a mesh in state then we need to
      // create a new mesh to replace the old one.
      if (
        previousProps.roomName !== nextProps.roomName &&
        this.state.mesh !== null
      ) {
        this.setState({ mesh: createPeersMesh(nextProps) });
      }
    }

    componentDidUpdate(previousProps: Props, previousState: State) {
      const nextState = this.state;
      // If the user audio changed then we want to disconnect the previous audio
      // nodes and/or connect the new audio nodes.
      if (previousState.userAudio !== nextState.userAudio) {
        // If we had a successful audio state previously then we need to
        // disconnect all of those nodes.
        if (previousState.userAudio.state === 'success') {
          const { nodes } = previousState.userAudio;
          // Disconnect all the nodes from each other.
          for (let i = 0; i < nodes.length - 1; i++) {
            nodes[i].disconnect(nodes[i + 1]);
          }
        }
        // If we now have a successful audio state then we need to connect all
        // of the nodes together.
        if (nextState.userAudio.state === 'success') {
          const { nodes } = nextState.userAudio;
          // Connect all the nodes to each other.
          for (let i = 0; i < nodes.length - 1; i++) {
            nodes[i].connect(nodes[i + 1]);
          }
          // Set the volume to maximum on our volume node.
          const volume = nodes[2];
          volume.gain.value = 1;
        }
      }
      // **NOTE:** It is important that this runs before the block that runs
      // `connect()`! This block will set streams depending on the user audio
      // state, and *then* we should `connect()`. We should not `connect()`
      // before we set the stream.
      if (
        // If we have a mesh in our new state.
        nextState.mesh !== null &&
        // If the mesh from our last state is different from the mesh in our new
        // state, or the user audio state changed.
        (previousState.mesh !== nextState.mesh ||
        previousState.userAudio !== nextState.userAudio)
      ) {
        if (nextState.userAudio.state === 'success') {
          // Set the last node in our array of user audio nodes to our mesh.
          const { nodes } = nextState.userAudio;
          nextState.mesh.setLocalAudio(nodes[nodes.length - 1]);
        } else {
          nextState.mesh.unsetLocalAudio();
        }
      }
      // If our mesh changed then we need to connect the new mesh and/or close
      // the old one depending on the change.
      if (previousState.mesh !== nextState.mesh) {
        // If we had an old peer mesh then we need to close it.
        if (previousState.mesh !== null) {
          // Close our previous mesh.
          previousState.mesh.close();
        }
        // If we have a new peer mesh then we need to connect it.
        if (nextState.mesh !== null) {
          // Connect the next peers mesh.
          nextState.mesh.connect()
            .catch(error => console.error(error));
          // Unsubscribe from the last name subscription if we have one.
          if (this.nameSubscription !== null) {
            this.nameSubscription.unsubscribe();
          }
          // Create a new subscription from the mesh’s local state. Every time
          // we get a new name then we want to update the local storage.
          this.nameSubscription = nextState.mesh.localState
            .map(({ name }) => name)
            .distinctUntilChanged()
            .subscribe({
              next: name => localStorage.setItem(nameKey, name),
            });
        }
      }
    }

    componentWillUnmount() {
      const { mesh } = this.state;
      // Unsubscribe from the name subscription if we have one.
      if (this.nameSubscription !== null) {
        this.nameSubscription.unsubscribe();
      }
      // Close the mesh if we have one.
      if (mesh !== null) {
        mesh.close();
      }
    }

    private handleUserAudioStream = (stream: MediaStream) => {
      // Update the state with the stream that we got.
      this.setState((state: State, props: Props): Partial<State> => ({
        userAudio: {
          state: 'success',
          // Create all of the audio nodes for the user audio state. They will
          // be `connect()`ed and `disconnect()`ed in `componentDidUpdate()`.
          nodes: [
            audioContext.createMediaStreamSource(stream),
            audioContext.createDynamicsCompressor(),
            audioContext.createGain(),
          ],
        },
        // Use the mesh from the previous state. If there is no mesh in the
        // previous state then we want to create a new mesh.
        mesh: state.mesh || createPeersMesh(props),
      }));
    };

    private handleUserAudioError = (error: mixed) => {
      // Update the state with our error and remove any mesh that we had.
      this.setState({
        userAudio: { state: 'error', error },
        mesh: null,
      });
    };

    private handleSelectDeviceID = (deviceID: string) => {
      // Update the state with the new device id.
      this.setState({ deviceID });
      // Update local storage with the new information.
      localStorage.setItem(deviceIDKey, deviceID);
    };

    private handleDisableAudio = () => this.setState({ disableAudio: true });
    private handleEnableAudio = () => this.setState({ disableAudio: false });

    render() {
      const { userAudio, mesh, deviceID, disableAudio } = this.state;
      return (
        <div>
          <UserAudioController
            deviceID={deviceID}
            errorRetryMS={500}
            onStream={this.handleUserAudioStream}
            onError={this.handleUserAudioError}
          />
          {(
            // Who’s ready for a monster ternary expression?? ;)
            //
            // If we are loading then we want the user to know that we are
            // currently loading.
            userAudio.state === 'loading' ? (
              null
            ) :
            // If we got an error then we want to give the user some feedback so
            // that they may know the nature of the error.
            userAudio.state === 'error' ? (
              // Render a special error screen for errors created when the user
              // does not give us access to their audio.
              userAudio.error.name === 'NotAllowedError' ||
              // Older implementations may use `SecurityError` instead of the
              // more recent `NotAllowedError`.
              userAudio.error.name === 'SecurityError' ? (
                <StudioUserAudioNotAllowed/>
              ) : (
                <StudioUserAudioNotFound/>
              )
            ) :
            // If we have a mesh instance then we want to render our studio
            // room.
            mesh !== null ? (
              <div>
                {renderButtons && renderButtons({ mesh })}
                <StudioRoom
                  mesh={mesh}
                  audioContext={audioContext}
                  deviceID={deviceID}
                  onSelectDeviceID={this.handleSelectDeviceID}
                  disableAudio={disableAudio}
                  onDisableAudio={this.handleDisableAudio}
                  onEnableAudio={this.handleEnableAudio}
                />
              </div>
            ) :
            // This should really be unreachable because we create a mesh
            // whenever we set `userAudio` to a success state. However, in the
            // case that we reach it then just render nothing.
            null as never
          )}
        </div>
      );
    }
  };
};

export const StudioRoomController = {
  createComponent,
};
