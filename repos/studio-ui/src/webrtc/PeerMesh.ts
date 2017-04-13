import { SignalClient, Signal, OfferSignal, AnswerSignal } from '@decode/studio-signal-exchange/client';

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
  private readonly signalClient: SignalClient;

  /**
   * The user provided callback we call to signal that a peer was added.
   */
  private readonly onAddConnection: (id: string, connection: RTCPeerConnection) => void;

  /**
   * The user provided callback we call to signal that a peer was removed.
   */
  private readonly onRemoveConnection: (id: string) => void;

  private readonly connections: Map<string, Peer>;

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
    this.connections = new Map();
  }

  public close(): void {
    this.signalClient.close();
  }

  public async connect(): Promise<void> {}

  private createConnection(address: string): void {
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
    this.connections.set(address, peer);
    // We added a connection so on the next turn of the event thread let our
    // consumers know. We defer this so that errors thrown will go uncaught.
    setImmediate(() => {
      this.onAddConnection(address, connection);
    });
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
  }

  private async handleSignal(address: string, signal: Signal): Promise<void> {}
}

/**
 * A thin wrapper around an `RTCPeerConnection` that adds a few extra methods
 * that are nice.
 */
class Peer {
  private readonly sendSignal: (signal: Signal) => void;

  public readonly connection: RTCPeerConnection;

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
