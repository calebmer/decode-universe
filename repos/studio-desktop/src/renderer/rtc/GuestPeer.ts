import { Peer, PeerConfig } from '@decode/studio-ui';

/**
 * A peer that we know is a guest. We should be receiving that peer’s local
 * recording over the course of the relationship.
 *
 * We only use one “class” of peer in the studio desktop client and we assume
 * that there will never be more then one host per room. Therefore all of our
 * peers in the studio desktop client are thought of as guests.
 */
// TODO: Do we need this?
export class GuestPeer extends Peer {
  constructor(config: PeerConfig) {
    super(config);
    // Create the recorder. Don’t wait for it to resolve.
  }
}
