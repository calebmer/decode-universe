import { v4 as uuid } from 'uuid';
import { Peer, PeerConfig, Recorder } from '@decode/studio-ui';

/**
 * A peer that we know is a guest. We should be receiving that peer’s local
 * recording over the course of the relationship.
 *
 * We only use one “class” of peer in the studio desktop client and we assume
 * that there will never be more then one host per room. Therefore all of our
 * peers in the studio desktop client are thought of as guests.
 */
export class GuestPeer extends Peer {
  private recorder: Promise<Recorder>;

  constructor(config: PeerConfig) {
    super(config);
    // Create the recorder. Don’t wait for it to resolve.
    this.recorder = this.createRecorder();
  }

  /**
   * Creates a recorder wrapped in a promise. The promise will resolve once we
   * receive a message from our recordee that they were sucessfully initialized.
   */
  private async createRecorder(): Promise<Recorder> {
    // Create the channel with a random label. We use a random label to ensure
    // that all the data channels we create are distinct.
    const channel = this.connection.createDataChannel(`recording:${uuid()}`);
    // Create a new recorder. Don’t wait for it to finish construction.
    const recorder = await Recorder.create(channel);
    // Add the recorder to the disposables array. If the peer closed before the
    // recorder promise resolved then dispose of the recorder once we get it.
    if (this.isClosed === true) {
      recorder.dispose();
    } else {
      this.disposables.push(recorder);
    }
    // Return the promise.
    return recorder;
  }

  /**
   * Tells the peer to start recording and the peer will begin to send all of
   * its audio over the recording data channel.
   */
  public async startRecording(): Promise<void> {
    // Await the recorder and start it.
    const recorder = await this.recorder;
    recorder.start();
  }

  /**
   * Tells the peer to stop recording and the peer wil stop sending all of its
   * audio over the recording data channel.
   */
  public async stopRecording(): Promise<void> {
    // Await the recorder and stop it.
    const recorder = await this.recorder;
    recorder.stop();
    // Create a new recorder. Don’t wait for it to resolve.
    this.recorder = this.createRecorder();
  }
}
