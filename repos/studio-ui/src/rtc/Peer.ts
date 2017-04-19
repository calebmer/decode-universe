import { Set, OrderedSet } from 'immutable';
import { Observable, BehaviorSubject } from 'rxjs';

/**
 * Some basic state that is shared between the peers in a peer to peer
 * connection.
 *
 * This state is designed to be easily serialized to and deserialized from JSON.
 */
export type PeerState = {
  /**
   * Whether or not the peer is a host of the room we are connected to. Hosts
   * have elevated privaleges.
   *
   * Technically this value is not secure! If a malicious actor wanted to they
   * could make themselves look like a host. Make sure nothing absolutely
   * catastrophic to security is hidden behind this flag because it can be
   * spoofed. Since the privaleges are relatively minor (hosts can start/stop
   * recordings, mute guests, and a few more administrative behaviors) we aren’t
   * currently too concerned with this attack vector.
   */
  readonly isHost: boolean,

  /**
   * The name of the peer.
   */
  readonly name: string,
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
 * A single peer that we communicate with over the course of our application’s
 * lifecycle.
 *
 * The peer is considered “open” on construction, and it can be closed with
 * `close()`.
 *
 * This class is not responsible for negotiations with the peer. That is the
 * responsibility of classes like `PeersMesh` or other orchestrators. This class
 * does all of the actual work required to communicate data between the peers,
 * but does not negotiate.
 *
 * You can visualize the connection modeled by the `Peer` class like so:
 *
 * ```
 * Peer A <-------------> Peer B
 * ```
 *
 * If we are peer A then we call any data related to peer A (which is us)
 * “local” and any data from peer B as “remote.” Both peers A and B will have an
 * instance of `Peer` that models the same connection. What is “local” and what
 * is “remote” is swapped in these two instances on different computers.
 */
export class Peer {
  /**
   * The DOM API object for the connection that we make with our peer.
   */
  public readonly connection: RTCPeerConnection;

  /**
   * All of the remote media streams that our peer has given us access to. As
   * the peer may add and remove streams over time this is an observable.
   */
  public readonly remoteStreams: Observable<OrderedSet<MediaStream>>;

  /**
   * Represents the status of the connection that we have with our peer.
   */
  public readonly connectionStatus: Observable<PeerConnectionStatus>;

  /**
   * The remote state subject is where we will send new state objects. The value
   * will be null while we are loading. The view into this subject for consumers
   * will filter out nulls.
   */
  private readonly remoteStateSubject = new BehaviorSubject<PeerState | null>(null);

  /**
   * The state of our peer. Will emit the most recent state that we know about
   * immeadiately on subscription unless we have not yet gotten state from our
   * peer. In that case there will be no emissions until the peer sends us their
   * state.
   */
  public readonly remoteState: Observable<PeerState> =
    this.remoteStateSubject.filter(state => state !== null);

  /**
   * The internal data channel we use to communicate peer state. `null` if we
   * are not the initiator in the peer connection and are waiting to get the
   * data channel.
   */
  private stateChannel: RTCDataChannel | null = null;

  /**
   * The current local state. This will only have a value if `stateChannel` is
   * null. Once we have a `stateChannel` this will be set to null and then never
   * updated again. We use it so that when `stateChannel` comes online we can
   * immeadiately send the latest local state.
   */
  private currentLocalState: PeerState | null;

  /**
   * Anything that should be disposed of when we close the peer.
   */
  private disposables: Array<Disposable> = [];

  constructor({
    isLocalInitiator,
    localStreams,
    localState,
  }: {
    isLocalInitiator: boolean,
    localStreams: Set<MediaStream>,
    localState: PeerState,
  }) {
    // Create a new connection using the pre-defined config.
    this.connection = new RTCPeerConnection(rtcConfig);
    // Add all of the local streams to our connection.
    localStreams.forEach(stream => {
      if (stream !== undefined) {
        this.connection.addStream(stream);
      }
    });
    // Set the current local state to the initial state we were given.
    this.currentLocalState = localState;
    // Create some observables that watch the connection and emit events.
    this.connectionStatus = watchConnectionStatus(this.connection);
    this.remoteStreams = watchRemoteStreams(this.connection);
    // If we are the initiator then we want to create some data channels. If we
    // are not the initiator then we want to set an event listener that waits
    // for the initiator to create new data channels.
    if (isLocalInitiator) {
      this.stateChannel = this.connection.createDataChannel('state');
      this.initializeStateChannel(this.stateChannel);
    } else {
      // Handle new data channels.
      const handleDataChannel = ({ channel }: RTCDataChannelEvent) => {
        // If this the channel for our state then update our instance and
        // initialize the channel.
        if (channel.label === 'state') {
          this.stateChannel = channel;
          this.initializeStateChannel(this.stateChannel);
          // Remove the data channel event listener. We don’t need it anymore!
          this.connection.removeEventListener('datachannel', handleDataChannel);
        }
      };
      // Add the data channel event listener. It will remove itself once its
      // mission is completed.
      this.connection.addEventListener('datachannel', handleDataChannel);
    }
  }

  /**
   * Initializes a state channel by sending the current local state to that
   * channel and adding event listeners which will maintain an observable for
   * that state.
   *
   * This is in its own method because there are two different ways that we may
   * get our state data channel.
   */
  private initializeStateChannel(channel: RTCDataChannel): void {
    // Send our current local state as soon as the channel opens. After we do
    // this we no longer need the `currentLocalState` property because
    // `initializeStateChannel()` should only ever be called once. So we remove
    // `currentLocalState`.
    if (this.currentLocalState !== null) {
      const sendInitialState = () => {
        // Send the current state before removing our reference to that state.
        channel.send(JSON.stringify(this.currentLocalState));
        this.currentLocalState = null;
        // Remove the event listener.
        channel.removeEventListener('open', sendInitialState);
      };
      // Add the event listener which will send our initial state.
      channel.addEventListener('open', sendInitialState);
    } else {
      throw new Error('Did not expect the current local state to be null.');
    }

    // Handles a message from our data channel by alerting any listeners to the
    // remote state observable that there is new data.
    const handleMessage = (event: MessageEvent) => {
      const remoteState: PeerState = JSON.parse(event.data);
      this.remoteStateSubject.next(remoteState);
    };

    // Handles an error from our data channel by alerting any listeners.
    const handleError = (event: ErrorEvent) => {
      this.remoteStateSubject.error(event.error);
    };

    // Add our event listeners to the data channel.
    channel.addEventListener('message', handleMessage);
    channel.addEventListener('error', handleError);

    // Add a disposable which cleans up our event listeners from the data
    // channel. They will be removed when the peer closes.
    this.disposables.push({
      dispose: () => {
        channel.removeEventListener('message', handleMessage);
        channel.removeEventListener('error', handleError);
      },
    });
  }

  /**
   * Closes the peer be closing the connection and disposing any other resources
   * created to communicate with the peer.
   */
  public close(): void {
    // Disposes all of our disposables.
    this.disposables.forEach(disposable => disposable.dispose());
    this.disposables = [];
    // If the connection is not already closed then close it.
    if (this.connection.signalingState !== 'closed') {
      this.connection.close();
    }
    // Complete our subjects. We are done with them.
    this.remoteStateSubject.complete();
  }

  /**
   * Sets the new local state. The peer will be notified and should update
   * accordingly.
   */
  public setLocalState(state: PeerState): void {
    if (this.stateChannel !== null && this.stateChannel.readyState === 'open') {
      this.stateChannel.send(JSON.stringify(state));
    } else {
      this.currentLocalState = state;
    }
  }

  /**
   * Adds a stream to the peer connection. The peer will be notified and should
   * update accordingly.
   */
  public addLocalStream(stream: MediaStream): void {
    this.connection.addStream(stream);
  }

  /**
   * Removes a stream from the peer connection. The peer will be notified and
   * should update accordingly.
   */
  public removeLocalStream(stream: MediaStream): void {
    this.connection.removeStream(stream);
  }
}

/**
 * Represents a connection status that we may be in with a peer. The values are
 * arranged in such a way to make the UI that represents a connection status
 * easy to render.
 */
export enum PeerConnectionStatus {
  /**
   * We have recognized that the peer exists and we are currently trying to
   * arrive at a stable connection with that peer.
   *
   * This is kind of like “loading.”
   */
  connecting,

  /**
   * We have a stable connection with our peer.
   */
  connected,

  /**
   * We lost the connection with our peer. Disconnects are not fatal, however!
   * Disconnects may be temporary if the peer’s internet connection is flaky,
   * for example.
   */
  disconnected,
}

/**
 * Watches the connection status for changes.
 */
function watchConnectionStatus(
  connection: RTCPeerConnection,
): Observable<PeerConnectionStatus> {
  return new Observable<PeerConnectionStatus>(observer => {
    // Immeadiately emit the connection status.
    observer.next(getConnectionStatus(connection.iceConnectionState));
    // This function will handle a change in the connection status by computing
    // the new connection status and emitting the new connection status.
    const handleChange = () => {
      observer.next(getConnectionStatus(connection.iceConnectionState));
    };
    // Add the event listener.
    connection.addEventListener('iceconnectionstatechange', handleChange);
    // Remove the event listener on unsubscribe.
    return () => {
      connection.removeEventListener('iceconnectionstatechange', handleChange);
    };
  });
}

/**
 * Converts an [`RTCIceConnectionState`][1] enum to the `PeerConnectionStatus`
 * enum which is simpler and easier for our UI to digest.
 *
 * [1]: https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/iceConnectionState#RTCIceConnectionState_enum
 */
function getConnectionStatus(iceConnectionState: string): PeerConnectionStatus {
  switch (iceConnectionState) {
    case 'new':
    case 'checking':
      return PeerConnectionStatus.connecting;
    case 'connected':
    case 'completed':
      return PeerConnectionStatus.connected;
    case 'failed':
    case 'disconnected':
    case 'closed':
      return PeerConnectionStatus.disconnected;
    default:
      return PeerConnectionStatus.connecting;
  }
}

/**
 * Creates an observable that tracks the array of `MediaStream`s produced by an
 * `RTCPeerConnection` instance.
 */
function watchRemoteStreams(
  connection: RTCPeerConnection,
): Observable<OrderedSet<MediaStream>> {
  return new Observable<OrderedSet<MediaStream>>(observer => {
    // Get the initial array of streams from the connection.
    let remoteStreams = OrderedSet(connection.getRemoteStreams());
    // Notify any listeners about that set of streams.
    observer.next(remoteStreams);

    /**
     * Handles the `addstream` event on `RTCPeerConnection`.
     */
    const handleAddStream = ({ stream }: MediaStreamEvent) => {
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
      // Add the stream to our array.
      remoteStreams = remoteStreams.add(stream);
      // Notify our subscribers about the new stream.
      observer.next(remoteStreams);
    };

    /**
     * Handles the `removestream` event on `RTCPeerConnection`.
     */
    const handleRemoveStream = ({ stream }: MediaStreamEvent) => {
      // If the stream was null then return!
      if (stream === null) {
        return;
      }
      // Remove the stream in the event from our array.
      remoteStreams = remoteStreams.delete(stream);
      // Notify our subscribers about the removed stream.
      observer.next(remoteStreams);
    };

    // Add event listeners.
    connection.addEventListener('addstream', handleAddStream);
    connection.addEventListener('removestream', handleRemoveStream);

    return () => {
      // Remove event listeners.
      connection.removeEventListener('addstream', handleAddStream);
      connection.removeEventListener('removestream', handleRemoveStream);
    };
  });
}
