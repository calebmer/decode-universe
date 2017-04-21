import { PeersMesh, PeerState } from '@decode/studio-ui';
import { GuestPeer } from './GuestPeer';

/**
 * A peers mesh where we assume that we, locally, are the host and that *all* of
 * our peers our guests. We can assume that all peers are guests because you can
 * only be a host using the desktop app and the desktop app only provides the
 * ability to *create* rooms. The desktop application cannot join arbitrary
 * rooms which another host created.
 *
 * The purpose of having a custom class for a host peer mesh is that we can
 * provide methods like `startRecording()` which will allow the host to
 * orchestrate the recording of its peers tracks.
 */
export class HostPeersMesh extends PeersMesh<GuestPeer> {
  public readonly recordings =
    this.peers
      .map(peers => (
        peers
          .map(peer => peer.recordingData)
          // .set('local', x)
      ));

  constructor({
    roomName,
    localState,
  }: {
    roomName: string,
    localState: PeerState,
  }) {
    super({
      roomName,
      localState,
      // We assume that all of the peers we connect to as the studio desktop
      // client are guests and not hosts! It is fairly safe to make this
      // assumption because the desktop client provides no way for a user to
      // join an arbitrary room. Each desktop client will create a UUID for each
      // room that it hosts. The only rooms that a desktop client can connect to
      // are the rooms whose UUIDs it generated. This means unless there is a
      // UUID collision we should not have to worry about two hosts in a single
      // room.
      createPeerInstance: config => new GuestPeer(config),
    });
  }

  /**
   * Start recording audio from all of our peers.
   */
  public startRecording(): void {
    // Instruct all of our peers to start recording.
    for (const [, peer] of this.currentPeers) {
      peer.startRecording();
    }
  }

  /**
   * Stop recording audio from all of our peers.
   */
  public stopRecording(): void {
    // Instruct all of our peers to stop recording.
    for (const [, peer] of this.currentPeers) {
      peer.stopRecording();
    }
  }
}
