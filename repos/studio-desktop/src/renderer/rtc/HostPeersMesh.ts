import { Observable, BehaviorSubject } from 'rxjs';
import { PeersMesh, PeerState, WAVRecorder } from '@decode/studio-ui';
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
  // /**
  //  * Create an observable for the recording stream of our local audio.
  //  */
  // private readonly localRecordingStream =
  //   this.localStreams
  //     // Get the first stream out of our set.
  //     .map(streams => streams.first())
  //     // We want to filter out streams that are exactly the same as the stream
  //     // before it.
  //     .distinctUntilChanged((a, b) => a === b)
  //     // If we have a new stream then record it.
  //     .switchMap<WAVRecorder.Chunk>(stream => stream !== undefined
  //       ? WAVRecorder.record(stream)
  //       : Observable.never())
  //     // Only emit the recorded data if we are presently recording.
  //     .filter(() => this.isRecording)
  //     // Get the `ArrayBuffer` from the chunk.
  //     .map(({ data }) => data.buffer);

  // /**
  //  * A higher level observable of the recording streams of all our peers and our
  //  * own local stream. New streams may be added and removed over the course of
  //  * time.
  //  *
  //  * This represents the final output of all the audio data we need to record
  //  * for this mesh.
  //  */
  // public readonly recordingStreams =
  //   this.peers
  //     .map(peers => (
  //       peers
  //         // Get the recording stream from our peer.
  //         .map(peer => peer.recordingStream)
  //         // Always add the local recording stream.
  //         .set('local', this.localRecordingStream)
  //     ));

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
  public async startRecording(): Promise<void> {
    // We keep a map of all the peers that errored so that we don’t have to stop
    // their recordings.
    const peerErrors = new Map<GuestPeer, mixed>();
    // Instruct all of our peers to start recording.
    await Promise.all(this.currentPeers.map(async peer => {
      // Try to start recording. If an error is thrown then add that to our
      // `peerErrors` map.
      try {
        await peer.startRecording();
      } catch (error) {
        peerErrors.set(peer, error);
      }
    }));
    // If some of our peers errored then we want to stop recording all of the
    // peers who did not error.
    if (peerErrors.size > 0) {
      await Promise.all(this.currentPeers.map(async peer => {
        // If the peer did not error then try to stop its recording. If an error
        // is thrown when we try to stop the recording then we ignore it.
        if (!peerErrors.has(peer)) {
          try {
            await peer.stopRecording();
          } catch (error) {
            // Noop...
          }
        }
      }));
      // Throw the first error we found.
      throw peerErrors.values().next().value;
    }
  }

  /**
   * Stop recording audio from all of our peers.
   */
  public async stopRecording(): Promise<void> {
    // Instruct all of our peers to stop recording.
    await Promise.all(this.currentPeers.map(async peer => {
      await peer.stopRecording();
    }));
  }
}
