import * as createDebugger from 'debug';
import { Set, OrderedMap } from 'immutable';
import { Observable, BehaviorSubject } from 'rxjs';
import { SignalClient, Signal } from '@decode/studio-signal-exchange';
import { Peer, PeerState } from './Peer';

const debug = createDebugger('@decode/studio-ui:PeersMesh');

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
export class PeersMesh {
  /**
   * The private subject observable that contains the immutable map of remote
   * peers we are connected to.
   *
   * We use a `BehaviorSubject` so that we can get the latest value of the
   * observable at any time (by using `.value`). This is critical to be able to
   * add or remove peers relative to what is already in the map.
   *
   * Whenever we need to add or remove a peer our code will often take the form
   * `this.peersSubject.next(this.peersSubject.value.add(...))` using
   * Immutable.js mutations to create a new `OrderedMap`.
   *
   * We do not want to expose the ability to call `next()` on the
   * `BehaviorSubject` to users so this property is private. Users are expected
   * to use the observable `peers` in order to see our peers. The `peers`
   * observable is simply a clone of `peersSubject` without the dangerous
   * mutating `next()`, `error()`, or `complete()` methods.
   *
   * The map is keyed by the address we use to send messages to our peer through
   * the `SignalClient`.
   */
  private readonly peersSubject = new BehaviorSubject(OrderedMap<string, Peer>());

  /**
   * All of the peers that we are currently connected to keyed by their unique
   * identifier given to us by our servers.
   */
  public readonly peers = this.peersSubject.asObservable();

  /**
   * A signal client instance that can be used to send signals to our peers
   * outside of the standard RTC process. This is required to negotiate the
   * terms of real time communication with a peer.
   */
  private readonly signals: SignalClient;

  constructor({
    roomName,
    localState,
  }: {
    roomName: string,
    localState: PeerState,
  }) {
    this.signals = new SignalClient({
      roomName,
      onSignal: (address, signal) => {
        this.handleSignal(address, signal)
          .catch(error => console.error(error));
      },
    });
    // Create the local state subject using the initial state provided to us.
    this.localStateSubject = new BehaviorSubject(localState);
    this.localState = this.localStateSubject.asObservable();
  }

  /**
   * Closes the mesh. We will disconnect from all our peers and we will receive
   * no more signals from those peers.
   */
  public close(): void {
    // Close our signal client instance.
    this.signals.close();
    // Clear out all of our peers. We are done with them.
    this.peersSubject.next(this.peersSubject.value.clear());
    // Close every peer that we know of.
    this.peersSubject.value.forEach(peer => {
      if (peer !== undefined) {
        peer.close();
      }
    });
    // Complete our subjects. We are done with them.
    this.peersSubject.complete();
    this.localStateSubject.complete();
    this.localStreamsSubject.complete();
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
    await Promise.all(addresses.map(async address => {
      debug(`Initiating connection with peer ${address}`);
      // Create the peer.
      this.createPeer(address, true);
      // Schedule negotiation with our peer.
      this.schedulePeerNegotiations(address);
    }));
  }

  /**
   * Creates a peer and adds some event listeners to the `RTCPeerConnection`
   * instance that we need for signaling and negotiation.
   */
  private createPeer(address: string, isLocalInitiator: boolean): Peer {
    // Create the peer.
    const peer = new Peer({
      isLocalInitiator,
      localState: this.localStateSubject.value,
      localStreams: this.localStreamsSubject.value,
    });
    // Update our peers map by adding this peer keyed by its address.
    this.peersSubject.next(this.peersSubject.value.set(address, peer));
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
          iceConnectionState === 'failed' ||
          iceConnectionState === 'closed'
        ) {
          // Close the peer.
          peer.close();
          // Remove the peer from our internal map.
          this.peersSubject.next(this.peersSubject.value.delete(address));
        }
      });
    }
    // Return the peer.
    return peer;
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
    this.peerNegotiationTimers.set(address, setTimeout(
      () => {
        // Delete the timer from our map now that it has completed.
        this.peerNegotiationTimers.delete(address);
        // Get the peer from our peers map.
        const peer = this.peersSubject.value.get(address);
        // If the peer no longer exists do not continue. Otherwise we want to
        // start negotiations with that peer.
        if (peer !== undefined) {
          this.startPeerNegotiations(address, peer)
            .catch(error => console.error(error));
        }
      },
      debounceNegotiationNeededMs,
    ));
  }

  /**
   * Starts negotiations with a peer by creating an offer and then sending that
   * offer to the peer.
   */
  private async startPeerNegotiations(
    address: string,
    peer: Peer,
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
    let peer: Peer | undefined = this.peersSubject.value.get(address);

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
        await peer.connection
          .setRemoteDescription(new RTCSessionDescription(signal));
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
        await peer.connection
          .setRemoteDescription(new RTCSessionDescription(signal));
        break;
      }

      // Whenever we get a candidate signal, we need to add the candidate to our
      // peer.
      case 'candidate': {
        const { sdpMLineIndex, candidate } = signal;
        peer.connection.addIceCandidate(new RTCIceCandidate({
          sdpMLineIndex,
          candidate,
        }));
        break;
      }
    }
  }

  /**
   * The local state on this peer mesh.
   */
  private readonly localStateSubject: BehaviorSubject<PeerState>;

  /**
   * The local state for this mesh. Use `setState` to update and the updates
   * from `setState` will be propogated to all of the peers in our mesh.
   */
  public readonly localState: Observable<PeerState>;

  /**
   * Updates the local state with a partial state object. Anyone listening to
   * the local state will be updated, and any peers will also be updated.
   */
  public updateLocalState(partialState: Partial<PeerState>): void {
    // Create the next state object.
    const nextState: PeerState = {
      ...this.localStateSubject.value,
      ...partialState,
    };
    // Updates the local state on all of our peers which will send out the
    // message.
    this.peersSubject.value.forEach(peer => {
      if (peer !== undefined) {
        peer.setLocalState(nextState);
      }
    });
    // Update our subject so that anyone observing can get the update.
    this.localStateSubject.next(nextState);
  }

  /**
   * A private cache of streams that will be used to hydrate peers when they
   * come online.
   */
  private readonly localStreamsSubject = new BehaviorSubject(Set<MediaStream>());

  /**
   * An observable that allows external consumers to see the internal state of
   * the local streams being distributed to peers inside the mesh.
   */
  public readonly localStreams = this.localStreamsSubject.asObservable();

  /**
   * Adds a stream that will be distributed to all of the peers in the mesh.
   */
  public addLocalStream(stream: MediaStream): void {
    debug('Added a local media stream');
    // Add the stream to all of our peers.
    this.peersSubject.value.forEach((peer, address) => {
      if (peer !== undefined && address !== undefined) {
        // Add the stream to the peer.
        peer.addLocalStream(stream);
        // Schedule negotiation with our peer.
        this.schedulePeerNegotiations(address);
      }
    });
    // Adds the stream to our local cache.
    this.localStreamsSubject.next(this.localStreamsSubject.value.add(stream));
  }

  /**
   * Removes a stream that will be removed from all of the peers in the mesh.
   */
  public removeLocalStream(stream: MediaStream): void {
    debug('Removed a local media stream');
    // Removes the stream from all our peers.
    this.peersSubject.value.forEach((peer, address) => {
      if (peer !== undefined && address !== undefined) {
        // Remove the stream from our peer.
        peer.removeLocalStream(stream);
        // Schedule negotiation with our peer.
        this.schedulePeerNegotiations(address);
      }
    });
    // Remove the stream from our local cache.
    this.localStreamsSubject.next(this.localStreamsSubject.value.remove(stream));
  }
}
