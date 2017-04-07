import { SignalClient, Signal } from '@decode/studio-signal-exchange/client';

export class PeerMesh {
  /**
   * The client we use to communicate with our signaling service. After we have
   * completed the signaling process our communications can be completely
   * peer-to-peer.
   */
  private readonly signaling: SignalClient;

  /**
   * A map of our peers to their address as we know it from the signaling
   * client.
   */
  private readonly peers: Map<string, RTCPeerConnection>;

  constructor(roomName: string) {
    this.signaling = new SignalClient({
      roomName,
      // On signals we want to handle using our custom method and log any errors
      // when we get them.
      onSignal: (from: string, signal: Signal) => {
        this.handleSignal(from, signal)
          .catch(error => console.error(error));
      },
    });
    this.peers = new Map();
  }

  /**
   * Shutdown the mesh by closing all of our connections.
   */
  public close(): void {
    this.signaling.close();
    this.peers.forEach(peer => peer.close());
  }

  /**
   * Connects to the mesh by sending an offer to all of the other peers in the
   * room specified in the room name we were given.
   */
  public async connect(): Promise<void> {
    // Connect to our signaling exchange and get all of the addresses that we
    // will need to connect to.
    const addresses = await this.signaling.connect();
    await Promise.all(addresses.map(async address => {
      // Create the peer.
      const peer = this.createPeer(address);
      // Create the offer that we will send to the peer.
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      // Type-check for TypeScript.
      if (offer.sdp === null) {
        throw new Error('Expected an `sdp` in the created offer.');
      }
      // Send the offer to the peer and wait for an answer.
      this.signaling.send(address, {
        type: 'offer',
        sdp: offer.sdp,
      });
    }));
  }

  /**
   * Handles a signal from our signaling client.
   */
  private async handleSignal(from: string, signal: Signal): Promise<void> {
    // If a we do not yet have a peer connection for the `from` address then let
    // us make one.
    if (!this.peers.has(from)) {
      this.createPeer(from);
    }
    // Get the peer using the `from` address.
    const peer = this.peers.get(from)!;

    switch (signal.type) {
      // When we get an offer singal then we want to setup our peer for that
      // offer by setting the remote description with the offer. After that we
      // want to generate an answer and send that answer through our signaling
      // service.
      case 'offer': {
        // Set the remote description to the offer we recieved.
        await peer.setRemoteDescription(new RTCSessionDescription(signal));
        // Create an answer.
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        // Type-check for TypeScript.
        if (answer.sdp === null) {
          throw new Error('Expected an `sdp` in the created answer.');
        }
        // Send the answer to the peer who was kind enough to generate us an
        // offer.
        this.signaling.send(from, {
          type: 'answer',
          sdp: answer.sdp,
        });
        break;
      }

      // When we get an answer back after we send an offer we want to set the
      // remote description on that peer. After this happens we should be in
      // business for peer-to-peer communciation!
      case 'answer': {
        await peer.setRemoteDescription(new RTCSessionDescription(signal));
        break;
      }
    }
  }

  /**
   * Creates a peer connection from an address that we will use to communicate
   * with that peer.
   *
   * We will set the peer we create into the `peers` map using the provided
   * address while also returning the created peer.
   */
  private createPeer(address: string): RTCPeerConnection {
    const peer = new RTCPeerConnection({});
    // Set the peer in our map of addresses to peers.
    this.peers.set(address, peer);
    return peer;
  }
}
