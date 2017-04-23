import { Peer, PeerConfig, PeerState, RemoteRecordee } from '@decode/studio-ui';

/**
 * A peer that might be a host, but we don’t actually know. We will only know
 * whether or not this peer is a host if they give us an `RTCDataChannel`
 * instance the label of which starts with `recording:`.
 *
 * We only use this “class” of peer in the Decode Studio Web client, but all
 * peers in the web client use this class. This is so that we aren’t required to
 * negotiate whether or not this peer is a host in the signaling phase.
 */
export class MaybeHostPeer extends Peer {
  /**
   * The recordees for this peer connection. This will be an empty array if the
   * peer is not a host and has no interest in recording. There will be as many
   * recordees in this array as there have been recordings initiated by the
   * host. Some of the recordees in this array will be stopped and others will
   * not be stopped.
   */
  private readonly recordees: Array<RemoteRecordee> = [];

  /**
   * The stream that is currently being recorded. `null` if we are not currently
   * recording a stream.
   */
  private recordingStream: MediaStream | null;

  /**
   * The human readable name for the recording.
   */
  private recordingName: string;

  constructor(config: PeerConfig) {
    super(config);
    // Get the stream we want to record. This will be the first stream in the
    // local streams set.
    this.recordingStream = config.localStream;
    // Set the name from our local state.
    this.recordingName = config.localState.name;
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
          RemoteRecordee.create(this.recordingName, channel).then(
            // If we suceeded in creating a recordee then set the stream to the
            // current recording stream and add the stream to our recordee and
            // disposable arrays. We want to update the recording stream in case
            // it changes, and we want to dispose the recordee when the peer
            // connection closes.
            recordee => {
              // Update the stream on the recordee.
              if (this.recordingStream === null) {
                recordee.unsetStream();
              } else {
                recordee.setStream(this.recordingStream);
              }
              // Store the recordee in some arrays where it can be accessed
              // later.
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

  public setLocalState(state: PeerState): void {
    super.setLocalState(state);
    // Update the human-readable recording name from the state.
    this.recordingName = state.name;
  }

  /**
   * Adds a local stream and updates the recording stream on our recordees.
   */
  public setLocalStream(stream: MediaStream): void {
    // Call our super class’s implementation.
    super.setLocalStream(stream);
    // Update our instance with the new stream to be recorded.
    this.recordingStream = stream;
    // Update the stream for all of the recordees that have not stopped.
    for (const recordee of this.recordees) {
      if (recordee.stopped !== true) {
        recordee.setStream(stream);
      }
    }
  }

  /**
   * Removes a local stream and updates the recording stream on our recordees.
   */
  public unsetLocalStream(): void {
    // Call our super class’s implementation.
    super.unsetLocalStream();
    // Update our instance with the new stream to be recorded.
    this.recordingStream = null;
    // Unset the stream for all of the recordees that have not stopped.
    for (const recordee of this.recordees) {
      if (recordee.stopped !== true) {
        recordee.unsetStream();
      }
    }
  }
}
