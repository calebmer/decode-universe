import { Peer, PeerConfig } from '@decode/studio-ui';

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

  constructor(config: PeerConfig) {
    super(config);
    // Manages an event listener that will listen to see if the peer ever gives
    // us a recording data channel. If it does then the peer is a host! We will
    // provide our recordings to this channel if we get it.
    {
      const handleDataChannel = ({ channel }: RTCDataChannelEvent) => {
        // If this the channel for the guest to send over its recorded information
        // the let us set that channel to our instance and remove this event
        // listener.
        if (channel.label === 'recording') {
          this.recordingChannel = channel;
          // Remove the data channel event listener. We don’t need it anymore!
          this.connection.removeEventListener('datachannel', handleDataChannel);
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
}
