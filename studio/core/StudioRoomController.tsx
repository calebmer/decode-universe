import * as React from 'react';
import dropRepeats from 'xstream/extra/dropRepeats';
import { css } from 'glamor';
import { LiveValue } from './stream/LiveValue';
import { ReactStream } from './stream/ReactStream';
import { UserAudioController } from './audio/UserAudioController';
import { PeersMesh } from './rtc/PeersMesh';
import { Peer } from './rtc/Peer';
import { StudioRoom } from './StudioRoom';
import { StudioUserAudioNotAllowed } from './StudioUserAudioNotAllowed';
import { StudioUserAudioNotFound } from './StudioUserAudioNotFound';

const deviceIDKey = '@decode/studio-core/deviceID';
const nameKey = '@decode/studio-core/name';

/**
 * Creates a `<StudioRoomController/>` component with some of the provided
 * configuration options.
 *
 * We need to provide configuration options because the
 * `<StudioRoomController/>` component is used in both the desktop and the web
 * Decode Studio clients. These two clients have different semantics. These
 * options are where the semantics may be injected.
 */
// prettier-ignore
// TODO: https://github.com/prettier/prettier/issues/1946
const createComponent = <
  TExtraProps extends {} = {},
  TPeersMesh extends PeersMesh<TPeer> = PeersMesh<TPeer>,
  TPeer extends Peer = Peer
>({
  createPeersMesh: userCreatePeersMesh,
  renderButtons,
  webURL = null,
}: {
  // Called when the component wants to create a new `PeersMesh` instance.
  createPeersMesh: (
    options: {
      roomName: string;
      localAudioContext: AudioContext;
      previousLocalName: string | null;
    },
  ) => TPeersMesh;

  // Renders some buttons at the top of the studio room UI.
  renderButtons?: (
    props: Readonly<TExtraProps>,
    state: Readonly<{ mesh: TPeersMesh }>,
  ) => JSX.Element;

  webURL?: string;
}): React.ComponentClass<{ roomName: string } & TExtraProps> => {
  type Props = {
    roomName: string;
  } & TExtraProps;

  type State = {
    audioContext: AudioContext;
    userAudio: UserAudioState;
    mesh: TPeersMesh | null;
  };

  type UserAudioState =
    | {
        state: 'loading';
      }
    | {
        state: 'error';
        error: any;
      }
    | {
        state: 'success';
        // A tuple of the audio nodes we use in the order which they are connected.
        // We will send the last node to our mesh.
        nodes: [
          // The source of our audio from a `MediaStream` received from
          // `getUserMedia()`.
          MediaStreamAudioSourceNode,
          // Highpass filter to remove frequencies below 80hz.
          BiquadFilterNode,
          // A dynamics compressor. We use Aaron Dowd’s settings for the compressor.
          // These settings can be seen in the image attached to issue [#16][1].
          //
          // [1]: https://github.com/calebmer/decode-universe/issues/16
          DynamicsCompressorNode,
          // A node which will allow us to adjust the volume of the output audio.
          //
          // **NOTE:** If the user wants to mute their audio they unset any local
          // streams instead of setting the volume to 0 on this gain node. This
          // ensures security as there is no chance any audio will be streamed to
          // the other peers. It also allows us to render a muted state for our
          // peers.
          GainNode
        ];
      };

  function createPeersMesh(
    { roomName }: Readonly<Props>,
    { audioContext }: Readonly<State>,
  ): TPeersMesh {
    return userCreatePeersMesh({
      roomName,
      localAudioContext: audioContext,
      previousLocalName: localStorage.getItem(nameKey),
    });
  }

  return class StudioRoomController extends React.Component<Props, State> {
    state: State = {
      audioContext: new AudioContext(),
      userAudio: { state: 'loading' },
      mesh: null,
    };

    // Create some behavior subjects which we will push updates to. Putting
    // these values in live values instead of state means we don’t need to
    // update the entire component tree whenever one value changes. We can
    // pinpoint the update to exactly the places which need it.
    private readonly deviceID = new LiveValue(
      localStorage.getItem(deviceIDKey),
    );
    private readonly disableAudio = new LiveValue(__DEV__);
    private readonly localVolume = new LiveValue(1);

    /**
    * We want to listen to our mesh’s local state so that whenever the name
    * changes we can store the new name in local storage. This is the
    * listener for that operation.
    */
    private nameUnsubscribe: (() => void) | null = null;

    componentWillReceiveProps(nextProps: Readonly<Props>) {
      const previousProps = this.props;
      // If the room name changed and we have a mesh in state then we need to
      // create a new mesh to replace the old one.
      if (
        previousProps.roomName !== nextProps.roomName &&
        this.state.mesh !== null
      ) {
        this.setState(previousState => ({
          mesh: createPeersMesh(nextProps, previousState),
        }));
      }
    }

    componentDidUpdate(previousProps: Readonly<Props>, previousState: Readonly<State>) {
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
          // Set the volume to whatever value is currently in state.
          const volume: GainNode = nodes[3];
          volume.gain.value = this.localVolume.get();
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
          nextState.mesh.connect().catch(error => console.error(error));
          // Unsubscribe from the last name subscription if we have one.
          if (this.nameUnsubscribe !== null) {
            this.nameUnsubscribe();
          }
          // Create a new stream from the mesh’s local state. Every time
          // we get a new name then we want to update local storage.
          const stream = nextState.mesh.localState
            .map(({ name }) => name)
            .compose(dropRepeats());

          const listener = {
            next: (name: string) => localStorage.setItem(nameKey, name),
          };

          stream.addListener(listener);
          this.nameUnsubscribe = () => stream.removeListener(listener);
        }
      }
    }

    componentWillUnmount() {
      const { audioContext, mesh } = this.state;
      // Close down the audio context releasing resources back to the system.
      audioContext.close();
      // Unsubscribe from the name subscription if we have one.
      if (this.nameUnsubscribe !== null) {
        this.nameUnsubscribe();
      }
      // Close the mesh if we have one.
      if (mesh !== null) {
        mesh.close();
      }
    }

    private handleUserAudioStream = (stream: MediaStream) => {
      // Update the state with the stream that we got.
      this.setState((state: Readonly<State>, props: Readonly<Props>): Partial<State> => ({
        userAudio: {
          state: 'success',
          // Create all of the audio nodes for the user audio state. They will
          // be `connect()`ed and `disconnect()`ed in `componentDidUpdate()`.
          nodes: [
            // Create the media stream source audio node.
            state.audioContext.createMediaStreamSource(stream),
            // Add a highpass filter to remove certain lower frequencies.
            (() => {
              const highpass = state.audioContext.createBiquadFilter();
              highpass.type = 'highpass';
              highpass.frequency.value = 80;
              return highpass;
            })(),
            // Add a dynamics compressor. We use Aaron Dowd’s settings which are
            // seen in the image attachement to issue [#16][1].
            //
            // [1]: https://github.com/calebmer/decode-universe/issues/16
            (() => {
              const compressor = state.audioContext.createDynamicsCompressor();
              compressor.threshold.value = -15;
              compressor.knee.value = 0.4;
              compressor.ratio.value = 1.5 / 1;
              compressor.attack.value = 50 / 1000;
              compressor.release.value = 200 / 1000;
              return compressor;
            })(),
            // Finally, create a gain audio node which users may use to adjust
            // their gain on the software side. If at all possible users should
            // adjust their gain on the hardware side!
            state.audioContext.createGain(),
          ],
        },
        // Use the mesh from the previous state. If there is no mesh in the
        // previous state then we want to create a new mesh.
        mesh: state.mesh || createPeersMesh(props, state),
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
      this.deviceID.set(deviceID);
      // Update local storage with the new information.
      localStorage.setItem(deviceIDKey, deviceID);
    };

    private handleDisableAudio = () => this.disableAudio.set(true);
    private handleEnableAudio = () => this.disableAudio.set(false);

    private handleLocalVolumeChange = (localVolume: number) => {
      const { userAudio } = this.state;
      // If we have some audio state then we want to update the gain value on
      // the volume with our new local volume.
      if (userAudio.state === 'success') {
        const volume: GainNode = userAudio.nodes[3];
        volume.gain.value = localVolume;
      }
      // Update our local volume state.
      this.localVolume.set(localVolume);
    };

    render() {
      const { audioContext, userAudio, mesh } = this.state;
      return (
        <div {...css({ height: '100%' })}>
          {ReactStream.render(this.deviceID, deviceID =>
            <UserAudioController
              deviceID={deviceID}
              errorRetryMS={500}
              onStream={this.handleUserAudioStream}
              onError={this.handleUserAudioError}
            />,
          )}
          {// Who’s ready for a monster ternary expression?? ;)
          //
          // If we are loading then we want the user to know that we are
          // currently loading.
          userAudio.state === 'loading'
            ? null
            : // If we got an error then we want to give the user some feedback so
              // that they may know the nature of the error.
              userAudio.state === 'error'
              ? // Render a special error screen for errors created when the user
                // does not give us access to their audio.
                userAudio.error.name === 'NotAllowedError' ||
                  // Older implementations may use `SecurityError` instead of the
                  // more recent `NotAllowedError`.
                  userAudio.error.name === 'SecurityError'
                ? <StudioUserAudioNotAllowed />
                : <StudioUserAudioNotFound />
              : // If we have a mesh instance then we want to render our studio
                // room.
                mesh !== null
                ? <div {...css({ height: '100%' })}>
                    {renderButtons && renderButtons(this.props, { mesh })}
                    <StudioRoom
                      mesh={mesh}
                      audioContext={audioContext}
                      deviceID={this.deviceID}
                      onSelectDeviceID={this.handleSelectDeviceID}
                      disableAudio={this.disableAudio}
                      onDisableAudio={this.handleDisableAudio}
                      onEnableAudio={this.handleEnableAudio}
                      localVolume={this.localVolume}
                      onLocalVolumeChange={this.handleLocalVolumeChange}
                      webURL={webURL}
                    />
                  </div>
                : // This should really be unreachable because we create a mesh
                  // whenever we set `userAudio` to a success state. However, in the
                  // case that we reach it then just render nothing.
                  null as never}
        </div>
      );
    }
  }
};

export const StudioRoomController = {
  createComponent,
};
