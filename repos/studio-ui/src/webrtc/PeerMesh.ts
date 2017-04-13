import { SignalClient, Signal } from '@decode/studio-signal-exchange/client';

/**
 * The configuration we use when creating `RTCPeerConnection` instances.
 *
 * There are some free STUN servers available to us. Let’s use them!
 */
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478?transport=udp' },
  ],
};

/**
 * The number of milliseconds to use when debouncing our response to an
 * `RTCPeerConnection`’s `negotiationneeded` event.
 */
const debounceNegotiationNeededMs = 200;

/**
 * A `PeerMesh` instance is responsible for creating and handling signaling
 * connections between peers in a mesh configuration. After establishing
 * connections and succesfully exchanging signals the `PeerMesh` will notify the
 * world of its new connection, and when that connection is terminated likewise
 * the `PeerMesh` will report that the peer should be deleted. The `PeerMesh`
 * will manage the closing of connections.
 *
 * `PeerMesh` *intentionally* does not handle any `MediaStream`s or
 * `RTCDataChannel`s between peers. This would only complicate the mesh protocol
 * implemented in this file.
 *
 * `PeerMesh` holds very little state, instead letting the state be handled by
 * external callers.
 */
export class PeerMesh {
  /**
   * Our client to the signaling exchange that we use to establish connections
   * between peers.
   */
  private readonly signalClient: SignalClient;

  /**
   * The user provided callback we call to signal that a peer was added.
   */
  private readonly onAddConnection: (
    id: string,
    connection: RTCPeerConnection,
  ) => void;

  /**
   * The user provided callback we call to signal that a peer was removed.
   */
  private readonly onRemoveConnection: (id: string) => void;

  /**
   * All of the peers that we know about in our mesh. Useful for routing signals
   * from our signaling exchange to the correct connection we have with that
   * peer.
   */
  private readonly peers: Map<string, Peer>;

  constructor({
    roomName,
    onAddConnection,
    onRemoveConnection,
  }: {
    roomName: string,
    onAddConnection: (id: string, peer: RTCPeerConnection) => void,
    onRemoveConnection: (id: string) => void,
  }) {
    this.signalClient = new SignalClient({
      roomName,
      onSignal: (address, signal) => {
        this.handleSignal(address, signal)
          .catch(error => console.error(error));
      },
    });
    this.onAddConnection = onAddConnection;
    this.onRemoveConnection = onRemoveConnection;
    this.peers = new Map();
  }

  /**
   * Closes our connection to the signaling exchange and all of our peers.
   *
   * This will also synchronously call `onRemoveConnection` for all of the peers
   * that are getting closed as a result of this.
   */
  public close(): void {
    // Close the signal client.
    this.signalClient.close();
    // Close every peer and call the remove callback with its address.
    this.peers.forEach((peer, address) => {
      peer.close();
      this.onRemoveConnection(address);
    });
  }

  /**
   * Connects the peer mesh to the signaling exchange and all other peers
   * currently in the room specified by `roomName` in the constructor.
   */
  public async connect(): Promise<void> {
    // Connect the signal client.
    const addresses = await this.signalClient.connect();
    // Create a peer for each of oru addresses and start negotiations.
    await Promise.all(addresses.map(async address => {
      // Create the peer.
      const peer = this.createPeer(address);
      // Start negotiations with the peer.
      await peer.startNegotiations();
    }));
  }

  /**
   * Handles a signal from the signaling change and routes that signal to the
   * appropriate peer signal handler.
   *
   * If the signal is an offer and we do not have a peer object for the provided
   * address then a peer object for that address will be created to handle the
   * signal.
   */
  private async handleSignal(address: string, signal: Signal): Promise<void> {
    // Get the peer using the provided address.
    let peer = this.peers.get(address);

    // If we could find no peer and the signal is an offer signal then let us
    // create a new peer. If we could not find a peer and the signal was *not*
    // an offer signal then we need to throw an error.
    if (peer === undefined) {
      if (signal.type === 'offer') {
        peer = this.createPeer(address);
      } else {
        throw new Error(`No peer found with address '${address}'.`);
      }
    }

    // Have the peer handle the signal.
    await peer.handleSignal(signal);
  }

  /**
   * Creates a new peer object complete with event listeners on the internal
   * `RTCPeerConnection` object.
   *
   * As side effects we call the `onAddConnection` callback synchronously just
   * before adding event listeners and adds the newly created peer to the
   * private instance `peers` map.
   */
  private createPeer(address: string): Peer {
    // Create the initial connection. We will adorn it with the appropriate
    // event listeners below.
    const connection = new RTCPeerConnection(rtcConfig);
    // Create a peer which is a thin wrapper around an `RTCPeerConnection` with
    // some helpful methods.
    const peer = new Peer({
      connection,
      sendSignal: signal => this.signalClient.send(address, signal),
    });
    // Add the connection to our map.
    this.peers.set(address, peer);
    // We added a connection so let our consumers know. We put this before we
    // register event listeners so that in case any initialization is done by
    // calling this then that initialization will be done before anything else.
    // This prevents us from triggering `negotiationneeded` during
    // initialization, for example.
    //
    // It is **VERY** important that this be run before adding an event listener
    // for `negotiationneeded` so we don’t capture any `negotiationneeded`
    // events triggered by this callback call.
    this.onAddConnection(address, connection);
    // When we are told that a negotiation is needed we need to start creating
    // and sending offers.
    //
    // We debounce the work done so that if many things trigger a
    // `negotiationneeded` in a connection in very short succession we should
    // only start one negotiation.
    {
      // The timer we use to debounce negotiations. `any` because timer types
      // are wierd.
      let debounceTimer: any = null;

      connection.addEventListener('negotiationneeded', () => {
        // If there is an active debounce timer, cancel it.
        if (debounceTimer !== null) {
          clearTimeout(debounceTimer);
        }
        // Set a new debounce timer with the configured debounce milliseconds.
        debounceTimer = setTimeout(
          () => {
            // Reset the debounce timer variable.
            debounceTimer = null;
            // Start peer negotiations!
            peer.startNegotiations().catch(error => console.error(error));
          },
          debounceNegotiationNeededMs,
        );
      });
    }
    // Everytime we get an ICE candidate, we want to send a signal to our peer
    // with the candidate information.
    {
      connection.addEventListener('icecandidate', event => {
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
        this.signalClient.send(address, {
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
      connection.addEventListener('iceconnectionstatechange', () => {
        const { iceConnectionState } = connection;
        // If the connection state is failed or closed then we want to destroy the
        // peer no questions asked.
        if (
          iceConnectionState === 'failed' ||
          iceConnectionState === 'closed'
        ) {
          // Close the peer.
          peer.close();
          // Remove the peer from our internal map.
          this.peers.delete(address);
          // Let the world know that the peer is gone.
          this.onRemoveConnection(address);
        }
      });
    }
    // Return the peer for good measure.
    return peer;
  }
}

/**
 * A thin wrapper around an `RTCPeerConnection` that adds a few extra methods
 * that are nice.
 */
class Peer {
  /**
   * The internal `RTCPeerConnection` instance we are wrapping.
   */
  public readonly connection: RTCPeerConnection;

  /**
   * A callback we invoke when we want to send a signal to the peer across the
   * network. This callback will be implemented by the `Peer` constructor.
   */
  private readonly sendSignal: (signal: Signal) => void;

  constructor({
    connection,
    sendSignal,
  }: {
    connection: RTCPeerConnection,
    sendSignal: (signal: Signal) => void,
  }) {
    this.connection = connection;
    this.sendSignal = sendSignal;
  }

  /**
   * Closes the peer by closing the underlying `RTCPeerConnection` instance.
   */
  public close(): void {
    this.connection.close();
  }

  /**
   * Starts negotiations with the peer by creating an offer and then sending
   * that offer as a signal to the peer.
   */
  public async startNegotiations(): Promise<void> {
    // Create the offer that we will send to the peer.
    const offer = await this.connection.createOffer();
    await this.connection.setLocalDescription(offer);
    // Type-check for TypeScript.
    if (offer.sdp === null) {
      throw new Error('Expected an `sdp` in the created offer.');
    }
    // Send the offer to the provided address using our new signal client.
    this.sendSignal({
      type: 'offer',
      sdp: offer.sdp,
    });
  }

  /**
   * Handles a signal sent by our peer to us. Sometimes we respond with a new
   * signal, but mostly we just register the signal in our local instance.
   */
  public async handleSignal(signal: Signal): Promise<void> {
    switch (signal.type) {
      // When we get an offer singal then we want to setup our peer for that
      // offer by setting the remote description with the offer. After that we
      // want to generate an answer and send that answer through our signaling
      // service.
      case 'offer': {
        // Set the remote description to the offer we recieved.
        await this.connection.setRemoteDescription(new RTCSessionDescription(signal));
        // Create an answer.
        const answer = await this.connection.createAnswer();
        await this.connection.setLocalDescription(answer);
        // Type-check for TypeScript.
        if (answer.sdp === null) {
          throw new Error('Expected an `sdp` in the created answer.');
        }
        // Send the answer to the peer who was kind enough to generate us an
        // offer.
        this.sendSignal({
          type: 'answer',
          sdp: answer.sdp,
        });
        break;
      }

      // When we get an answer back after we send an offer we want to set the
      // remote description on that peer. After this happens we should be in
      // business for peer-to-peer communciation!
      case 'answer': {
        await this.connection.setRemoteDescription(new RTCSessionDescription(signal));
        break;
      }

      // Whenever we get a candidate signal, we need to add the candidate to our
      // peer.
      case 'candidate': {
        const { sdpMLineIndex, candidate } = signal;
        this.connection.addIceCandidate(new RTCIceCandidate({
          sdpMLineIndex,
          candidate,
        }));
        break;
      }
    }
  }
}
