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
    stream: MediaStream,
  };

  function createPeersMesh({ roomName }: Props): TPeersMesh {
    return userCreatePeersMesh({
      roomName,
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

    private nameSubscription: Subscription | null = null;

    componentDidUpdate(previousProps: Props, previousState: State) {
      const nextState = this.state;
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
          nextState.mesh.setLocalStream(nextState.userAudio.stream);
        } else {
          nextState.mesh.unsetLocalStream();
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
        userAudio: { state: 'success', stream },
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
            // This should really be unreachable. However, in the case that we
            // reach it then just render nothing.
            null
          )}
        </div>
      );
    }
  };
};

export const StudioRoomController = {
  createComponent,
};
