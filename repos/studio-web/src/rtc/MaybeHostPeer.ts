import { Peer, PeerConfig, RemoteRecordee } from '@decode/studio-ui';

export class MaybeHostPeer extends Peer {
  /**
   * The recordees for this peer connection. This will be an empty array if the
   * peer is not a host and has no interest in recording. There will be as many
   * recordees in this array as there have been recordings initiated by the
   * host. Some of the recordees in this array will be stopped and others will
   * not be stopped.
   */
  private readonly recordees: Array<RemoteRecordee> = [];

  // TODO: There must be a better way to handle this?
  private readonly localStreams = new Set<MediaStream>();

  /**
   * The stream that is currently being recorded. `null` if we are not currently
   * recording a stream.
   */
  private recordingStream: MediaStream | null;

  constructor(config: PeerConfig) {
    super(config);
    // Get the stream we want to record. This will be the first stream in the
    // local streams set.
    this.recordingStream = config.localStreams.first() || null;
    // Watch for the recording data channel and if we get such a channel then we
    // want to respond by creating a `RemoteRecordee` instance. We may get may
    // recording data channels over the course of our connection.
    {
      // Receives new data channels. If it is a recording data channel then we
      // want to initialize a recordee for that channel.
      const handleDataChannel = ({ channel }: RTCDataChannelEvent) => {
        // Make sure this is a data channel for recordings by checking the
        // label.
        if (/^recording:/.test(channel.label)) {
          // Create a recordee from the channel.
          RemoteRecordee.create(channel).then(
            // If we suceeded in creating a recordee then set the stream to the
            // current recording stream and add the stream to our recordee and
            // disposable arrays. We want to update the recording stream in case
            // it changes, and we want to dispose the recordee when the peer
            // connection closes.
            recordee => {
              recordee.setStream(this.recordingStream);
              this.recordees.push(recordee);
              this.disposables.push(recordee);
            },
            // Report any errors.
            error => console.error(error),
          );
        }
      };
      // Add the data channel event listener.
      this.connection.addEventListener('datachannel', handleDataChannel);
      // Add a disposable which removes the data channel event listener.
      this.disposables.push({
        dispose: () =>
          this.connection.removeEventListener('datachannel', handleDataChannel),
      });
    }
  }

  /**
   * Adds a local stream and updates the recording stream on our recordees.
   */
  public addLocalStream(stream: MediaStream): void {
    super.addLocalStream(stream);
    this.localStreams.add(stream);
    this.updateRecordingStream();
  }

  /**
   * Removes a local stream and updates the recording stream on our recordees.
   */
  public removeLocalStream(stream: MediaStream): void {
    super.removeLocalStream(stream);
    this.localStreams.delete(stream);
    this.updateRecordingStream();
  }

  /**
   * Updates the recording stream on our recordees based on the current
   * `localStreams` mutable set.
   */
  private updateRecordingStream(): void {
    // Get the first stream from our local streams set.
    const recordingStream: MediaStream | null =
      this.localStreams.values().next().value || null;
    // Update what the current recording stream is on the instance.
    this.recordingStream = recordingStream;
    // Update the recording stream for all of the recordees that have not
    // stopped.
    this.recordees.forEach(recordee => {
      if (recordee.stopped !== true) {
        recordee.setStream(recordingStream);
      }
    });
  }
}
