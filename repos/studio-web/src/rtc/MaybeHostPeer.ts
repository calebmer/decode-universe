import { Peer, PeerConfig, WAVRecorder } from '@decode/studio-ui';
import { Subscription } from 'rxjs';

/**
 * A peer that might be the host, we don’t actually know for sure. This peer
 * will listen for new data channels. If it gets a recording data channel then
 * we know for sure that the peer is a host. Until we either get that recording
 * data channel or the connection is closed we won’t know whether or not the
 * peer is actually a host.
 *
 * We only use one “class” of peer in the studio web client, so we need to be
 * indeterminate in this way.
 */
export class MaybeHostPeer extends Peer {
  /**
   * Whether or not we have been told to start recording. This will only be
   * `true` if our peer is a host and they have sent us a message that we should
   * be recording.
   */
  private isRecording = false;

  /**
   * A recording data channel. If the peer is a host then this will not be null
   * after the connection initializes. If the peer is a fellow guest then this
   * channel will stay null for the duration of the connection.
   *
   * If the channel is not null then this guest will send recording information
   * over the channel to the peer.
   */
  private recordingChannel: RTCDataChannel | null = null;

  /**
   * The current `MediaStream` we are recording. `null` if we are not currently
   * recording anything.
   */
  private recordingLocalStream: MediaStream | null = null;

  /**
   * The subscription that represents what we are currently recording.
   */
  private recordingSubscription: Subscription | null = null;

  constructor(config: PeerConfig) {
    super(config);
    // If we had a set of local streams then get the first of those and set it
    // on our peer instance.
    this.recordingLocalStream = config.localStreams.first() || null;
    // Manages an event listener that will listen to see if the peer ever gives
    // us a recording data channel. If it does then the peer is a host! We will
    // provide our recordings to this channel if we get it.
    {
      const handleDataChannel = ({ channel }: RTCDataChannelEvent) => {
        // If this is the channel for the guest to send over its recorded
        // information the let us set that channel to our instance and remove
        // this event listener.
        if (channel.label === 'recording') {
          // Remove the data channel event listener. We don’t need it anymore!
          this.connection.removeEventListener('datachannel', handleDataChannel);
          // Set the channel on our class instance.
          this.recordingChannel = channel;
          // Add an event listener to handle messages from our recording
          // channel.
          this.recordingChannel
            .addEventListener('message', this.handleRecordingMessage);
          // Add a disposable which will remove the recording message handler
          // from the recording channel.
          this.disposables.push({
            dispose: () =>
              this.recordingChannel && this.recordingChannel
                .removeEventListener('message', this.handleRecordingMessage),
          });
        }
      };
      // Add the data channel event listener.
      this.connection.addEventListener('datachannel', handleDataChannel);
      // Add a disposable that will remove the event listener in case the
      // connection closes and we didn’t get a data channel.
      this.disposables.push({
        dispose: () =>
          this.connection.removeEventListener('datachannel', handleDataChannel),
      });
    }
  }

  /**
   * Handles a message from our host peer who wants to record our audio. This
   * will never be used if our peer is not a host.
   */
  private handleRecordingMessage = (event: MessageEvent) => {
    switch (event.data) {
      // If we are not currently recording anything and we have a local stream
      // which needs to be recorded then start recording!
      case 'start': {
        // We are recording now. Let the world know!
        this.isRecording = true;
        if (
          this.recordingSubscription === null &&
          this.recordingLocalStream !== null
        ) {
          this.recordingSubscription = recordLocalStream(
            this.recordingChannel!,
            this.recordingLocalStream,
          );
        }
        break;
      }
      // If we were told to stop recording then cleanup our recording
      // subscription.
      case 'stop': {
        // We have stopped recording...
        this.isRecording = false;
        if (this.recordingSubscription !== null) {
          this.recordingSubscription.unsubscribe();
          this.recordingSubscription = null;
        }
        break;
      }
      // Throw an error if we don’t recognize the data.
      default: {
        console.error(new Error(
          'A recording message was provided that has an undefined behavior.'
        ));
      }
    }
  };

  /**
   * Closes our peer and any recordings we may have started.
   */
  public close(): void {
    // Call our parent class’s logic.
    super.close();
    // If we had a recording subscription then unsubscribe and set the
    // subscription to null.
    if (this.recordingSubscription !== null) {
      this.recordingSubscription.unsubscribe();
      this.recordingSubscription = null;
    }
  }

  /**
   * Add the media stream locally and if this peer is a host plus we are not
   * currently recording another stream then start recording this stream and
   * sending that data to the host.
   */
  public addLocalStream(stream: MediaStream): void {
    // Call our parent class’s logic.
    super.addLocalStream(stream);
    // If we are already recording a stream then we don’t want to stop that!
    if (this.recordingLocalStream !== null) {
      return;
    }
    // Add this stream to the instance because we are recording it now.
    this.recordingLocalStream = stream;
    // If our peer is a host (aka `recordingChannel` is not null), and we should
    // be currently recording, but we have no subscription as evidence that we
    // are recording then start actually recording!
    if (
      this.recordingChannel !== null &&
      this.isRecording === true &&
      this.recordingSubscription === null
    ) {
      this.recordingSubscription = recordLocalStream(
        this.recordingChannel,
        this.recordingLocalStream,
      );
    }
  }

  /**
   * Remove the stream and if we were recording that stream then stop recording
   * it.
   */
  public removeLocalStream(stream: MediaStream): void {
    // Call our parent class’s logic.
    super.removeLocalStream(stream);
    // If we are not removing the current stream to be recorded the we don’t
    // want to continue executing.
    if (this.recordingLocalStream !== stream) {
      return;
    }
    // Remove the local stream we were recording.
    this.recordingLocalStream = null;
    // If we had a recording subscription then unsubscribe and set the
    // subscription to null.
    if (this.recordingSubscription !== null) {
      this.recordingSubscription.unsubscribe();
      this.recordingSubscription = null;
    }
  }
}

/**
 * Records the audio data from the stream passed in and sends the recorded data
 * to the `RTCDataChannel` instance provided.
 *
 * We will also send a string, “next second,” on the channel when the second
 * time changes. This is so that the host can keep track of the time at a second
 * level of granularity.
 */
function recordLocalStream(
  channel: RTCDataChannel,
  localStream: MediaStream,
): Subscription {
  return WAVRecorder.record(localStream).subscribe({
    // Send any data we get and a “next second” event if it is indeed the next
    // second.
    next: chunk => channel.send(chunk.data.buffer),
    // Report errors.
    error: error => console.error(error),
  });
}
