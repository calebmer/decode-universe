import * as React from 'react';
import { SignalClient, Signal } from '@decode/studio-signal-exchange/client';

type Props = {
  roomName: string,
  render: (addresses: Array<string>) => JSX.Element,
};

type State = {
  signalClient: SignalClient,
  peers: { [address: string]: RTCPeerConnection | undefined },
};

export class PeerMesh extends React.Component<Props, State> {
  public state: State = {
    signalClient: this.createSignalClient(),
    peers: {},
  };

  componentDidMount() {
    // Connect our signal client now that the component has mounted.
    this.connectSignalClient().catch(error => console.error(error));
  }

  // It is **very** important to remeber that this method is side-effect free!
  // Any method you call in here should be free of side-effects. The only
  // exception is `setState`. React allows side-effects from `setState` in this
  // method **only**.
  protected componentWillReceiveProps(nextProps: Props) {
    const previousProps = this.props;
    // If the room name changed then we need to create a new signal client and
    // set it to state. We are not allowed to perform side effects in
    // `componentWillReceiveProps` so the opening and closing of clients is done
    // in `componentDidUpdate`.
    if (previousProps.roomName !== nextProps.roomName) {
      this.setState({
        signalClient: this.createSignalClient(nextProps),
        // Reset the peers to an empty object as well.
        peers: {},
      });
    }
  }

  protected componentDidUpdate(previousProps: Props, previousState: State) {
    const nextState = this.state;
    // If the previous state had a different `SignalClient` instance then need
    // to close the old instance and connect the new instance.
    if (previousState.signalClient !== nextState.signalClient) {
      // Close the previous signal client and all of the previous peers.
      previousState.signalClient.close();
      closePeers(previousState.peers);
      // Connect the new signal client.
      this.connectSignalClient().catch(error => console.error(error));
    }
  }

  protected componentWillUnmount() {
    // Close our signal client and peers.
    this.state.signalClient.close();
    closePeers(this.state.peers);
  }

  /**
   * Creates a new instance of `SignalClient` using the component’s props. This
   * should only be called if we have cleaned up the last `SignalClient`
   * instance.
   *
   * This method is side-effect free.
   */
  private createSignalClient(props: Props = this.props): SignalClient {
    return new SignalClient({
      roomName: props.roomName,
      onSignal: (from, signal) => {
        // Whenever we get a signal we want to handle it. This function will not
        // be called until the signal client is connected and so it won’t
        // generate side effects.
        this.handleSignal(from, signal)
          .catch(error => console.error(error));
      },
    });
  }

  /**
   * Connects a signal client and sends offers to other peers in the same room.
   * This method has a lot of side-effects!
   */
  private async connectSignalClient(): Promise<void> {
    const { signalClient } = this.state;
    // Connect the new signal client.
    const addresses = await signalClient.connect()
    // Connect all of the addresses as peers in parallel.
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
      // Send the offer to the provided address using our new signal client.
      signalClient.send(address, {
        type: 'offer',
        sdp: offer.sdp,
      });
    }));
  }

  /**
   * Creates a new peer connection and enqueues a state update with `setState`
   * adding that peer to the `peers` state map.
   */
  private createPeer(address: string): RTCPeerConnection {
    // Create the peer.
    const peer = new RTCPeerConnection({});
    // Add the peer to our map of addresses to peers.
    this.setState(previousState => ({
      peers: {
        ...previousState.peers,
        [address]: peer,
      },
    }));
    return peer;
  }

  /**
   * Handles a signal from our signaling client.
   */
  private async handleSignal(from: string, signal: Signal): Promise<void> {
    // It is actually important that we destructure up here. This ensures that
    // `this.state` will not change under us while we do asynchronous work.
    const { signalClient, peers } = this.state;
    // Get the peer from our peers map.
    let peer = peers[from];
    // If the peer does not exist we need to create a new peer.
    if (peer === undefined) {
      peer = this.createPeer(from);
    }
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
        signalClient.send(from, {
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

  public render() {
    return this.props.render(Object.keys(this.state.peers));
  }
}

/**
 * Closes the peers object we have in state.
 */
function closePeers(peers: { [address: string]: RTCPeerConnection | undefined }): void {
  for (const [, peer] of Object.entries(peers)) {
    if (peer !== undefined) {
      peer.close();
    }
  }
}
