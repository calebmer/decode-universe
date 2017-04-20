import { v4 as uuid } from 'uuid';
import { appendFile } from 'fs';
import { Peer, PeerConfig } from '@decode/studio-ui';

/**
 * A peer that we know is a guest. We should be receiving that peer’s local
 * recording over the course of the relationship.
 *
 * We only use one “class” of peer in the studio desktop client and we assume
 * that there will never be more then one host per room. Therefore all of our
 * peers in the studio desktop client are thought of as guests.
 */
export class GuestPeer extends Peer {
  /**
   * The channel on which we expect the guest peer to publish their recording
   * channel data.
   */
  private readonly recordingChannel: RTCDataChannel;

  private readonly recordingFilePath =
    `/Users/calebmer/Desktop/${uuid()}`;

  constructor(config: PeerConfig) {
    super(config);
    // Create the data channel.
    this.recordingChannel = this.connection.createDataChannel('recording');
    // Add the appropriate event listeners to our recording channel so that we
    // may appropriately handle issues.
    {
      // Adds the event listeners to handle messages from our recording data
      // channel.
      this.recordingChannel
        .addEventListener('message', this.handleRecordeeMessage);
      this.recordingChannel
        .addEventListener('error', this.handleRecordeeError);
      // Add a disposable that will remove the event listeners when the peer is
      // closed.
      this.disposables.push({
        dispose: () => {
          this.recordingChannel
            .removeEventListener('message', this.handleRecordeeMessage);
          this.recordingChannel
            .removeEventListener('error', this.handleRecordeeError);
        },
      });
    }
  }

  /**
   * Handle a message from our recordee by adding it to a file where we are
   * storing all of the recording data. We don’t store the data in memory
   * because that will grow memory pretty quickly! Also, this way, if the
   * application crashes we have a backup.
   */
  private handleRecordeeMessage = (event: MessageEvent) => {
    // We currently don’t want to run this code, but we also don’t want to
    // comment it out so that TypeScript will still work.
    if (0 !== 0) {
      const buffer: ArrayBuffer = event.data;
      // Append the channel data to our temporary recording file. If there is
      // an error then we need to report it.
      appendFile(this.recordingFilePath, toBuffer(buffer), error => {
        if (error) {
          console.error(error);
        }
      });
    }
  };

  /**
   * Handle an error from our recordee by logging it.
   */
  private handleRecordeeError = (event: ErrorEvent) => {
    console.log(event.error);
  };
}

/**
 * Converts an `ArrayBuffer` into a Node.js `Buffer`.
 */
function toBuffer(arrayBuffer: ArrayBuffer): Buffer {
  return new Buffer(new Uint8Array(arrayBuffer));
}
