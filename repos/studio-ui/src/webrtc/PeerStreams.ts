import { Set as ImmutableSet, OrderedSet } from 'immutable';
import { Observable } from 'rxjs';

/**
 * Subscribes to an observable of local streams and makes sure that the
 * `RTCPeerConnection` instance always knows about the latest streams.
 *
 * Returns a cleanup function that unsubscribes from the observable and removes
 * all the streams that may have been added to the `RTCPeerConnection`.
 */
function maintainLocalStreams(
  connection: RTCPeerConnection,
  observable: Observable<ImmutableSet<MediaStream>>,
): {
  dispose: () => void,
} {
  // Maintain a variable that keeps a set of the last media streams we got. We
  // will use this to diff against new media streams and update the
  // `RTCPeerConnection` accordingly.
  let lastLocalStreams = ImmutableSet<MediaStream>();
  // Subscribe to the observable and handle its results.
  const subscription = observable.subscribe({
    // If we get a new local streams set then we want to diff that with the last
    // set we got and remove/add the different streams.
    next: localStreams => {
      // Create a new mutable copy of the local streams.
      const localStreamsMutable = new Set<MediaStream>(localStreams as any);
      // Go through all of our last streams. If one of the streams does not
      // exist in our new set of streams then we need to remove it from our
      // connection.
      lastLocalStreams.forEach(stream => {
        // Make sure the stream is not undefined.
        if (stream === undefined) {
          return;
        }
        // If our new local streams does not have this stream then we need to
        // remove the stream from our `RTCPeerConnection` instance.
        //
        // If we do have the local stream then we need to delete the stream from
        // our local, mutable, set so that we do not add it again after this
        // loop completes.
        if (!localStreamsMutable.has(stream)) {
          connection.removeStream(stream);
        } else {
          localStreamsMutable.delete(stream);
        }
      });
      // For all of the streams that remain in our mutable local streams we want
      // to add those streams to the connection. All of the streams that had
      // already been added to the connection were removed from the mutable set.
      localStreamsMutable.forEach(stream => {
        connection.addStream(stream);
      });
      // Make sure our new local streams are set as the last local streams for
      // next time.
      lastLocalStreams = localStreams;
    },

    // If we got an error then we want to report that error and we want to
    // remove all of the streams.
    error: error => {
      // Remove all of the last streams.
      lastLocalStreams.forEach(stream => {
        if (stream !== undefined) {
          connection.removeStream(stream);
        }
      });
      // Reset the last local streams.
      lastLocalStreams = ImmutableSet<MediaStream>();
      // Report the error.
      console.error(error);
    },

    // If the observable completed then we want to remove all of the streams
    // from the connection.
    complete: () => {
      // Remove all of the last streams.
      lastLocalStreams.forEach(stream => {
        if (stream !== undefined) {
          connection.removeStream(stream);
        }
      });
      // Reset the last local streams.
      lastLocalStreams = ImmutableSet<MediaStream>();
    },
  });
  return {
    // Cleanup the work we have done.
    dispose: () => {
      // Unsubscribe from our subscription.
      subscription.unsubscribe();
      // Remove all of the last streams.
      lastLocalStreams.forEach(stream => {
        if (stream !== undefined) {
          connection.removeStream(stream);
        }
      });
      // Reset the last local streams.
      lastLocalStreams = ImmutableSet<MediaStream>();
    },
  };
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

export const PeerStreams = {
  maintainLocalStreams,
  watchRemoteStreams,
};
