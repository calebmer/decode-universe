import { Observable } from 'rxjs';
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

  public readonly recordingData: Observable<ArrayBuffer>;

  constructor(config: PeerConfig) {
    super(config);
    // Create the data channel.
    this.recordingChannel = this.connection.createDataChannel('recording');
    // Create an observable which will forward all of the recording data coming
    // from our recording channel to any curious observers.
    this.recordingData = new Observable<ArrayBuffer>(observer => {
      // Handle messages by forwarding them to the observer.
      const handleMessage = (event: MessageEvent) => {
        observer.next(event.data);
      };
      // Handle errors by forwarding them to the observer.
      const handleError = (event: ErrorEvent) => {
        observer.error(event.error);
      };
      // Add the event listeners.
      this.recordingChannel.addEventListener('message', handleMessage);
      this.recordingChannel.addEventListener('error', handleError);
      return () => {
        // Remove the event listeners.
        this.recordingChannel.removeEventListener('message', handleMessage);
        this.recordingChannel.removeEventListener('error', handleError);
      };
    });
  }

  /**
   * Tells the peer to start recording and the peer will begin to send all of
   * its audio over the recording data channel.
   */
  public startRecording(): void {
    this.recordingChannel.send('start');
  }

  /**
   * Tells the peer to stop recording and the peer wil stop sending all of its
   * audio over the recording data channel.
   */
  public stopRecording(): void {
    this.recordingChannel.send('stop');
  }
}
