import { OrderedSet } from 'immutable';
import { Observable } from 'rxjs';

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
  public readonly streams: Observable<OrderedSet<MediaStream>>;

  /**
   * Disposables that are to be disposed of when we close the peer.
   */
  private disposables: Array<{ dispose: () => void }> = [];

  constructor() {
    // Create a new connection using the pre-defined config.
    this.connection = new RTCPeerConnection(rtcConfig);

    // Make sure to have a lazy observable ready for all of the remote streams
    // we expect to be generated by this peer.
    this.streams = watchRemoteStreams(this.connection);
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
  }

  /**
   * Adds a stream to the peer connection. The peer will be notified and should
   * update accordingly.
   */
  public addStream(stream: MediaStream): void {
    this.connection.addStream(stream);
  }

  /**
   * Removes a stream from the peer connection. The peer will be notified and
   * should update accordingly.
   */
  public removeStream(stream: MediaStream): void {
    this.connection.removeStream(stream);
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
