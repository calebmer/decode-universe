import * as React from 'react';
import { SignalClient, Signal } from '@decode/studio-signal-exchange/client';

type Props = {
  roomName: string,
  stream: MediaStream | null,
  render: (peers: Array<Peer>) => JSX.Element,
};

type Peer = {
  id: string,
  stream: MediaStream | null,
};

type State = {
  signalClient: SignalClient,
  peers: { [address: string]: PeerState | undefined },
};

type PeerState = {
  connection: RTCPeerConnection,
  // We allow a peer to give us multiple streams, but we only end up delivering
  // the first one to our children.
  streams: Array<MediaStream>,
};

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
 * Allow 2 seconds for a reconnection before destroying a connection when it
 * disconnects.
 */
const reconnectTimeout = 2000;

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
    const nextProps = this.props;
    const nextState = this.state;
    // If the previous state had a different `SignalClient` instance then need
    // to close the old instance and connect the new instance.
    if (previousState.signalClient !== nextState.signalClient) {
      // Close the previous signal client and all of the previous peers.
      previousState.signalClient.close();
      closePeers(previousState);
      // Connect the new signal client.
      this.connectSignalClient().catch(error => console.error(error));
    }
    // If the stream updated then we need to remove all of the old streams on
    // our peers and add this new stream.
    if (previousProps.stream !== nextProps.stream) {
      for (const [address, peer] of Object.entries(nextState.peers)) {
        if (peer !== undefined) {
          if (previousProps.stream !== null) {
            peer.connection.removeStream(previousProps.stream);
          }
          if (nextProps.stream !== null) {
            peer.connection.addStream(nextProps.stream);
          }
          // Because we changed the stream we will need to re-negotiate.
          this.startPeerNegotiations(address, peer.connection)
            .catch(error => console.error(error));
        }
      }
    }
  }

  protected componentWillUnmount() {
    // Close our signal client and peers.
    this.state.signalClient.close();
    closePeers(this.state);
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
    const { stream } = this.props;
    const { signalClient } = this.state;
    // Connect the new signal client.
    const addresses = await signalClient.connect()
    // Connect all of the addresses as peers in parallel.
    await Promise.all(addresses.map(async address => {
      // Create the peer.
      const peer = this.createPeer(address);
      // Start peer negotiations, but only if there is a stream!
      if (stream !== null) {
        await this.startPeerNegotiations(address, peer);
      }
    }));
  }

  /**
   * Creates a new peer connection and enqueues a state update with `setState`
   * adding that peer to the `peers` state map.
   *
   * Only one side of the peer-to-peer connection is allowed to make offers.
   * That would be the peer who connects to the room last. For those peers we
   * will create their connection object with the second `canMakeOffers` set to
   * true.
   */
  private createPeer(address: string): RTCPeerConnection {
    const { signalClient } = this.state;
    // Create the peer.
    const connection = new RTCPeerConnection(rtcConfig);
    // Everytime we get an ICE candidate, we want to send a signal to our peer
    // with the candidate information.
    connection.addEventListener('icecandidate', event => {
      // Skip if the event candidate is null.
      if (event.candidate === null) {
        return;
      }
      const { sdpMLineIndex, candidate } = event.candidate;
      // Make sure that the values we need are not null. If they are then we can
      // just skip this event.
      if (candidate === null || sdpMLineIndex === null) {
        return;
      }
      // Send a candidate signal to our peer.
      signalClient.send(address, {
        type: 'candidate',
        sdpMLineIndex,
        candidate,
      });
    });
    // Watch the ICE connection state for any changes.
    let reconnectTimer: number | null = null;
    connection.addEventListener('iceconnectionstatechange', event => {
      // Clear our reconnect timer if it exists.
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
      }
      const { iceConnectionState } = connection;
      // If the connection state is failed or closed then we want to destroy the
      // peer no questions asked.
      if (iceConnectionState === 'failed' || iceConnectionState === 'closed') {
        this.destroyPeer(address);
      }
      // If we disconnected then we want to wait a bit before destroying the
      // connection. This is because the connection may recover from a
      // disconnect on spotty internet.
      if (iceConnectionState === 'disconnected') {
        reconnectTimer = setTimeout(() => {
          this.destroyPeer(address);
        }, reconnectTimeout);
      }
    });
    // Every time our peer has a new stream available for us we need to take
    // that stream and use it to update our state.
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
          [address]: {
            ...previousState.peers[address],
            streams: [...previousState.peers[address]!.streams, stream],
          },
        },
      }));
    });
    // Whenever our peer wants to remove a stream we respect that request and
    // remove it from our peer state.
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
          [address]: {
            ...previousState.peers[address],
            // Remove the stream using `filter` and a referential equality
            // check.
            streams: previousState.peers[address]!.streams.filter(
              previousStream => previousStream !== stream,
            ),
          },
        },
      }));
    });
    {
      const { stream } = this.props;
      // Add the stream we were given in props to the peer connection we are
      // creating. This will trigger an `icecandidate` event.
      if (stream !== null) {
        connection.addStream(stream);
      }
    }
    // Add the peer to our map of addresses to peers.
    this.setState((previousState: State): Partial<State> => ({
      peers: {
        ...previousState.peers,
        [address]: {
          connection,
          streams: [],
        },
      },
    }));
    // Return the connection.
    return connection;
  }

  /**
   * Starts negotiations with the provided peer by creating and sending an
   * offer.
   */
  private async startPeerNegotiations(
    address: string,
    peer: RTCPeerConnection,
  ): Promise<void> {
    const { signalClient } = this.state;
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
  }

  /**
   * Destroys a peer by closing its RTC connection and removing it from state.
   */
  private destroyPeer(address: string): void {
    // Get the peer’s connection and close it.
    const peer = this.state.peers[address];
    if (peer !== undefined) {
      peer.connection.close();
    }
    // Remove the peer from state.
    this.setState((previousState: State): Partial<State> => ({
      peers: {
        ...previousState.peers,
        [address]: undefined,
      },
    }));
  }

  /**
   * Handles a signal from our signaling client.
   */
  private async handleSignal(from: string, signal: Signal): Promise<void> {
    // It is actually important that we destructure up here. This ensures that
    // `this.state` will not change under us while we do asynchronous work.
    const { signalClient, peers } = this.state;
    // Get the peer from our peers map, or create a new peer if no peer exists
    // in the map.
    let peer = peers[from] !== undefined
      ? peers[from]!.connection
      : this.createPeer(from);

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

      // Whenever we get a candidate signal, we need to add the candidate to our
      // peer.
      case 'candidate': {
        const { sdpMLineIndex, candidate } = signal;
        peer.addIceCandidate(new RTCIceCandidate({
          sdpMLineIndex,
          candidate,
        }));
        break
      }
    }
  }

  public render() {
    // Create our peers array from our peers object.
    const peers =
      Array.from(Object.entries(this.state.peers))
        .filter(([, peer]) => peer !== undefined)
        .map(([address, peer]): Peer => ({
          id: address,
          stream: peer!.streams[0] || null,
        }));
    // Call our children render function with our peers.
    return this.props.render(peers);
  }
}

/**
 * Closes the peers object we have in state.
 */
function closePeers(state: State): void {
  for (const [, peer] of Object.entries(state.peers)) {
    if (peer !== undefined) {
      peer.connection.close();
    }
  }
}
