import * as createDebugger from 'debug';
import { OrderedMap } from 'immutable';
import { Stream } from 'xstream';
import EventEmitter from '~/utils/universal/EventEmitter';
import SignalClient from '~/studio/signal/client/SignalClient';
import { Signal } from '~/studio/signal/shared/MessageTypes';
import LiveValue from '../stream/LiveValue';
import Peer from './Peer';

const debug = createDebugger('@decode/studio-core:PeersMesh');

/**
 * The number of milliseconds to use when debouncing our response to an
 * `RTCPeerConnection`’s `negotiationneeded` event.
 */
const debounceNegotiationNeededMs = 200;

/**
 * Manages the orchestration of the connection to many peers in a mesh format.
 * This means that every peer is connected to every other peer and between each
 * connection the peers exchange data and `MediaStream`s. The arrangement may be
 * visualized as follows:
 *
 * ```
 * a <----> b
 * ^ \    / ^
 * |  \  /  |
 * |   \/   |
 * |   /\   |
 * |  /  \  |
 * v /    \ v
 * c <----> d
 * ```
 *
 * Each node is connected to each other in a mesh. If we look from the
 * perspective of just one node, `a`, then we can’t see the entire mesh. Instead
 * we can only see our peers `b`, `c`, and `d`.
 *
 * ```
 *      a
 *     /|\
 *    / | \
 *   /  |  \
 *  /   |   \
 * b    c    d
 * ```
 *
 * The `PeerMesh` class is implemented from the perspective of a single, local,
 * node. `PeerMesh` orchestrates the connections between our “local” node (`a`)
 * and one or more “remote” nodes (or peers; `b`, `c`, and `d`).
 *
 * We find our peers using the room name that is passed into the constructor,
 * and we only connect to the mesh after `connect()` is called. To disconnect
 * from the mesh one needs to call `close()`.
 */
class PeersMesh<TPeer extends Peer = Peer> extends EventEmitter<
  PeersMesh.EventMap
> {
  /**
   * The private subject value that contains the immutable map of remote
   * peers we are connected to.
   *
   * The map is keyed by the address we use to send messages to our peer through
   * the `SignalClient`.
   */
  private readonly _peers = new LiveValue(OrderedMap<string, TPeer>());

  /**
   * All of the peers that we are currently connected to keyed by their unique
   * identifier given to us by our servers.
   */
  public readonly peers = this._peers.asStream();

  /**
   * The current set of peers.
   */
  public currentPeers(): OrderedMap<string, TPeer> {
    return this._peers.get();
  }

  /**
   * The local audio context we use for our audio.
   */
  public readonly localAudioContext: AudioContext;

  /**
   * Used to create a peer instance. Different studio clients may want to
   * communicate with their peers differently so this allows them to extend the
   * `Peer` class and initiate their own custom peers.
   */
  private readonly createPeerInstance: (config: Peer.Config) => TPeer;

  /**
   * A signal client instance that can be used to send signals to our peers
   * outside of the standard RTC process. This is required to negotiate the
   * terms of real time communication with a peer.
   */
  private readonly signals: SignalClient;

  /**
   * Get the room name that the mesh is connected to.
   */
  public get roomName(): string {
    return this.signals.roomName;
  }

  constructor({
    signalServerURL,
    roomName,
    localAudioContext,
    localState,
    createPeerInstance,
  }: {
    signalServerURL: string;
    roomName: string;
    localAudioContext: AudioContext;
    localState: Peer.State;
    createPeerInstance: (config: Peer.Config) => TPeer;
  }) {
    super();
    // Set some properties on the class instance.
    this.localAudioContext = localAudioContext;
    this.createPeerInstance = createPeerInstance;
    // Create the signal client.
    this.signals = new SignalClient({ serverURL: signalServerURL, roomName });
    // Add an event listener to our signal client.
    this.signals.on('signal', ({ from, signal }) => {
      this.handleSignal(from, signal).catch(error => console.error(error));
    });
    // Create the local state subject using the initial state provided to us.
    this._localState = new LiveValue(localState);
    this.localState = this._localState.asStream();
  }

  /**
   * Closes the mesh. We will disconnect from all our peers and we will receive
   * no more signals from those peers.
   */
  public close(): void {
    // Close our signal client instance.
    this.signals.close();
    // Close every peer that we know of.
    this._peers.get().forEach((peer, address) => {
      this.deletePeer(address, peer);
    });
    // Complete our subjects. We are done with them.
    this._peers.shamefullySendComplete();
    this._localState.shamefullySendComplete();
    this._localAudio.shamefullySendComplete();
  }

  /**
   * Connects us to a mesh of peers. The specific mesh is specified by the
   * `roomName` we were given at construction. Connects to the signaling server
   * and all the peers currently in the room.
   */
  public async connect(): Promise<void> {
    // Connect the signal client and get the addresses that are currently in the
    // room we pointed the signal client towards.
    const addresses = await this.signals.connect();
    // Create a peer for each of our addresses and start negotiations.
    await Promise.all(
      addresses.map(async address => {
        debug(`Initiating connection with peer ${address}`);
        // Create the peer.
        this.createPeer(address, true);
        // Schedule negotiation with our peer.
        this.schedulePeerNegotiations(address);
      }),
    );
  }

  /**
   * Creates a peer and adds some event listeners to the `RTCPeerConnection`
   * instance that we need for signaling and negotiation.
   */
  protected createPeer(address: string, isLocalInitiator: boolean): TPeer {
    // Create the peer using the `createPeerInstance()` function we were
    // provided in the constructor.
    const peer = this.createPeerInstance({
      isLocalInitiator,
      localAudioContext: this.localAudioContext,
      localState: this._localState.get(),
      localAudio: this._localAudio.get(),
    });
    // Update our peers map by adding this peer keyed by its address.
    this._peers.update(_ => _.set(address, peer));
    // Emit the add peer event.
    this.emit('addPeer', { address, peer });
    // Everytime we get an ICE candidate, we want to send a signal to our peer
    // with the candidate information.
    {
      peer.connection.addEventListener('icecandidate', event => {
        // Skip if the event candidate is null.
        if (event.candidate === null) {
          return;
        }
        const { sdpMLineIndex, candidate } = event.candidate;
        // Make sure that the values we need are not null. If they are then we
        // can just skip this event.
        if (candidate === null || sdpMLineIndex === null) {
          return;
        }
        // Send a candidate signal to our peer.
        this.signals.send(address, {
          type: 'candidate',
          sdpMLineIndex,
          candidate,
        });
      });
    }
    // We want to listen for complete disconnects from our peer and when they
    // occur we want to close the connection and notify the outside world about
    // the close.
    //
    // Note that we are not concerned with the temporary disconnects that may
    // happen from time to time over the course of a connection. Only the total,
    // fatal, disconnects. Temporary disconnect handling should be done
    // elsewhere.
    {
      peer.connection.addEventListener('iceconnectionstatechange', () => {
        const { iceConnectionState } = peer.connection;
        // If the connection state is failed or closed then we want to destroy the
        // peer no questions asked.
        if (
          (iceConnectionState === 'failed' ||
            iceConnectionState === 'closed') &&
          peer.isClosed === false
        ) {
          // Delete the peer.
          this.deletePeer(address, peer);
        }
      });
    }
    // Return the peer.
    return peer;
  }

  /**
   * Deletes and closes a peer that we don’t need anymore.
   */
  protected deletePeer(address: string, peer: TPeer): void {
    // Close the peer.
    peer._close();
    // Remove the peer from our internal map.
    this._peers.update(_ => _.delete(address));
    // Emit the delet peer event.
    this.emit('deletePeer', { address, peer });
  }

  /**
   * A map of the timers that we track to implement peer negotiation scheduling.
   */
  private readonly peerNegotiationTimers = new Map<string, any>();

  /**
   * Schedules negotiations with the peer at the given address using a debounce
   * scheduling algorithm. We wait x milliseconds and if another peer
   * negotiation is requested in that time then we will cancel the first request
   * and wait another x milliseconds for the request to either be cancelled or
   * executed if it was not cancelled in that time.
   *
   * If by the time the peer negotiation is started there is no peer with the
   * given address then nothing will happen.
   */
  private schedulePeerNegotiations(address: string): void {
    // If we already have a timer running for this address then let us clear it.
    // We are about to set a new timer.
    if (this.peerNegotiationTimers.has(address)) {
      clearTimeout(this.peerNegotiationTimers.get(address));
    }
    // Start a timeout and set the reference in our timers map. This timeout
    // will be cancelled if another peer negotiation is scheduled.
    this.peerNegotiationTimers.set(
      address,
      setTimeout(() => {
        // Delete the timer from our map now that it has completed.
        this.peerNegotiationTimers.delete(address);
        // Get the peer from our peers map.
        const peer = this._peers.get().get(address);
        // If the peer no longer exists do not continue. Otherwise we want to
        // start negotiations with that peer.
        if (peer !== undefined) {
          this.startPeerNegotiations(address, peer).catch(error =>
            console.error(error),
          );
        }
      }, debounceNegotiationNeededMs),
    );
  }

  /**
   * Starts negotiations with a peer by creating an offer and then sending that
   * offer to the peer.
   */
  private async startPeerNegotiations(
    address: string,
    peer: TPeer,
  ): Promise<void> {
    debug(`Starting negotiations with peer ${address}`);
    // Create the offer that we will send to the peer.
    const offer = await peer.connection.createOffer();
    await peer.connection.setLocalDescription(offer);
    // Type-check for TypeScript.
    if (offer.sdp === null) {
      throw new Error('Expected an `sdp` in the created offer.');
    }
    // Send the offer to the provided address using our new signal client.
    this.signals.send(address, {
      type: 'offer',
      sdp: offer.sdp,
    });
  }

  /**
   * Handles a signal sent to us by the peer with the provided address.
   */
  private async handleSignal(address: string, signal: Signal): Promise<void> {
    // Get the peer using the provided address.
    let peer: TPeer | undefined = this._peers.get().get(address);

    // If we could find no peer and the signal is an offer signal then let us
    // create a new peer. If we could not find a peer and the signal was *not*
    // an offer signal then we need to throw an error.
    if (peer === undefined) {
      if (signal.type === 'offer') {
        peer = this.createPeer(address, false);
      } else {
        throw new Error(`No peer found with address '${address}'.`);
      }
    }

    switch (signal.type) {
      // When we get an offer singal then we want to setup our peer for that
      // offer by setting the remote description with the offer. After that we
      // want to generate an answer and send that answer through our signaling
      // service.
      case 'offer': {
        // Set the remote description to the offer we recieved.
        await peer.connection.setRemoteDescription(
          new RTCSessionDescription(signal),
        );
        // Create an answer.
        const answer = await peer.connection.createAnswer();
        await peer.connection.setLocalDescription(answer);
        // Type-check for TypeScript.
        if (answer.sdp === null) {
          throw new Error('Expected an `sdp` in the created answer.');
        }
        // Send the answer to the peer who was kind enough to generate us an
        // offer.
        this.signals.send(address, {
          type: 'answer',
          sdp: answer.sdp,
        });
        break;
      }

      // When we get an answer back after we send an offer we want to set the
      // remote description on that peer. After this happens we should be in
      // business for peer-to-peer communciation!
      case 'answer': {
        await peer.connection.setRemoteDescription(
          new RTCSessionDescription(signal),
        );
        break;
      }

      // Whenever we get a candidate signal, we need to add the candidate to our
      // peer.
      case 'candidate': {
        const { sdpMLineIndex, candidate } = signal;
        peer.connection.addIceCandidate(
          new RTCIceCandidate({
            sdpMLineIndex,
            candidate,
          }),
        );
        break;
      }
    }
  }

  /**
   * The local state on this peer mesh.
   */
  private readonly _localState: LiveValue<Peer.State>;

  /**
   * The local state for this mesh. Use `setState` to update and the updates
   * from `setState` will be propogated to all of the peers in our mesh.
   */
  public readonly localState: Stream<Peer.State>;

  /**
   * The current local peer state.
   */
  public currentLocalState(): Peer.State {
    return this._localState.get();
  }

  /**
   * Sets the local name for our peer and notifies all of our peers about the
   * update.
   */
  public setLocalName(name: string): void {
    this.updateLocalState({ name });
  }

  /**
   * Updates the local state with a partial state object. Anyone listening to
   * the local state will be updated, and any peers will also be updated.
   */
  private updateLocalState(partialState: Partial<Peer.State>): void {
    // Create the next state object.
    const nextState: Peer.State = {
      ...this._localState.get(),
      ...partialState as any,
    };
    // Updates the local state on all of our peers which will send out the
    // message.
    this._peers.get().forEach(peer => {
      peer._setLocalState(nextState);
    });
    // Update our subject so that anyone observing can get the update.
    this._localState.set(nextState);
  }

  /**
   * The internal implementation of `localAudio`. Allows us to manipulate
   * `localAudio` without exposing the `Subject` functions to the outside
   * world.
   */
  private readonly _localAudio = new LiveValue<AudioNode | null>(null);

  /**
   * A stream of the state of our local audio. `null` if we don’t
   * currently have local audio. This may happen before any audio is
   * loaded, or when the user is muted.
   */
  public readonly localAudio = this._localAudio.asStream();

  /**
   * The current local audio at this point in time. `null` if the local audio
   * is currently unset.
   */
  public currentLocalAudio(): AudioNode | null {
    return this._localAudio.get();
  }

  /**
   * Sets the audio that we will send to all of our peers.
   *
   * If this is called while the local audio is muted then we will stay muted,
   * but when the local audio is unmuted whatever the latest audio to be set
   * with `setLocalAudio()` or `unsetLocalAudio()` will be restored.
   */
  public setLocalAudio(audio: AudioNode): void {
    // If we are not muted then we want to set the streaam. Otherwise we want to
    // store the stream on our instance so that when we are unmuted we can
    // pickup with that stream.
    if (this.currentLocalState().isMuted === true) {
      this.mutedLocalAudio = audio;
      return;
    }
    // Add the stream to all of our peers.
    this._peers.get().forEach((peer, address) => {
      if (address !== undefined) {
        // Add the audio to the peer.
        peer._setLocalAudio(audio);
      }
    });
    // Send the next local audio stream.
    this._localAudio.set(audio);
  }

  /**
   * Unsets the local audio effectively muting ourselves. If there was no
   * audio previously then the local audio will continue to be unset.
   *
   * If this is called while the local audio is muted then we will stay muted,
   * but when the local audio is unmuted whatever the latest stream to be set
   * with `setLocalAudio()` or `unsetLocalAudio()` will be restored.
   */
  public unsetLocalAudio(): void {
    // If we are muted then we just want to unset our local media stream so that
    // we can continue where we left off when the mesh is unmuted.
    if (this.currentLocalState().isMuted === true) {
      this.mutedLocalAudio = null;
      return;
    }
    // Add the stream to all of our peers.
    this._peers.get().forEach((peer, address) => {
      if (address !== undefined) {
        // Unset the local audio.
        peer._unsetLocalAudio();
      }
    });
    // Send the next local audio stream.
    this._localAudio.set(null);
  }

  /**
   * The `AudioNode` which we intend to restore when the mesh is unmuted.
   * `null` if we don’t intend to restore a stream or we are not muted.
   *
   * This will be updated when `setLocalAudio()` is called while we are muted.
   */
  private mutedLocalAudio: AudioNode | null = null;

  /**
   * Mutes the local audio. All audio will be removed from our peers. They
   * shouldn’t be able to here us when we are muted!
   */
  public muteLocalAudio(): void {
    // Make sure that we are not already muted.
    if (this.currentLocalState().isMuted === true) {
      throw new Error('Stream is already muted.');
    }
    // Set the muted local stream to whatever is the current local stream.
    this.mutedLocalAudio = this.currentLocalAudio();
    // Unset the local stream before we switch muted to true.
    this.unsetLocalAudio();
    // Update our local state to tell the world we are muted.
    this.updateLocalState({ isMuted: true });
  }

  /**
   * Unmutes the local audio. Whatever audio we had when we muted or whatever
   * audio was set with `setLocalAudio()` or `unsetLocalAudio()` while we
   * were muted will be restored.
   */
  public unmuteLocalAudio(): void {
    // Make sure that we are are not already unmuted.
    if (this.currentLocalState().isMuted === false) {
      throw new Error('Stream is not muted.');
    }
    // Update our local state to tell the world we are not muted.
    this.updateLocalState({ isMuted: false });
    // Update our stream based on the muted local stream we have been updating.
    if (this.mutedLocalAudio === null) {
      this.unsetLocalAudio();
    } else {
      this.setLocalAudio(this.mutedLocalAudio);
    }
    // “Delete” our muted local stream. We won’t need it again until we are
    // muted.
    this.mutedLocalAudio = null;
  }
}

namespace PeersMesh {
  /**
   * The map of events that the peer mesh will emit from time to time.
   */
  export interface EventMap {
    addPeer: { address: string; peer: Peer };
    deletePeer: { address: string; peer: Peer };
  }
}

export default PeersMesh;
