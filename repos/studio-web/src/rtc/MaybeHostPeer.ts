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
        // If this the channel for the guest to send over its recorded
        // information the let us set that channel to our instance and remove
        // this event listener.
        if (channel.label === 'recording') {
          this.recordingChannel = channel;
          // Remove the data channel event listener. We don’t need it anymore!
          this.connection.removeEventListener('datachannel', handleDataChannel);
          // The following code block is responsible for starting to record when
          // the channel opens. If we got a local stream before we got the
          // recording channel then we won’t be recording and so we need to
          // start the recording in that case.
          {
            // The handler which starts recording when the channel opens and
            // removes itself as an event listener when that happens.
            const startRecording = () => {
              // Remove self as an event listener.
              channel.removeEventListener('open', startRecording);
              // If we already have a local stream that we should be recording
              // then start recording that stream and sending its data to the
              // channel we just got.
              if (
                this.recordingLocalStream !== null &&
                this.recordingSubscription === null
              ) {
                this.recordingSubscription = recordLocalStream(
                  channel,
                  this.recordingLocalStream,
                );
              }
            };
            // Add the event listener. Wait for the channel to open and then we
            // can start recording.
            channel.addEventListener('open', startRecording);
          }
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
    // If we have a recording channel the start recording the local stream and
    // sending it to that channel.
    if (this.recordingChannel !== null) {
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
 */
function recordLocalStream(
  channel: RTCDataChannel,
  localStream: MediaStream,
): Subscription {
  return WAVRecorder.record(localStream).subscribe({
    // Send any data we get.
    next: data => channel.send(data.buffer),
    // Report errors.
    error: error => console.error(error),
  });
}
