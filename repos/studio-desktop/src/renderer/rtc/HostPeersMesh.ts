import { v4 as uuid } from 'uuid';
import {
  PeersMesh,
  Peer,
  PeerState,
  LocalRecorder,
  RemoteRecorder,
} from '@decode/studio-ui';
import { PersistRecording } from './audio/PersistRecording';
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
  /**
   * If we are currently recording then this is the `PersistRecording` instance
   * that is doing all of the recording heavy work.
   */
  private recording: PersistRecording | null = null;

  /**
   * The recorder that we use to record our local audio stream. This may be used
   * accross any number of recordings. If calling `stop()` on the `recorder`
   * stops the local recorder then we will set it to null.
   *
   * `null` if there is currently no initialized recorder.
   */
  private localRecorder: LocalRecorder | null = null;

  /**
   * A map of peers to the recorder ids provided by the `Recording` instance
   * when adding a recorder for the peer.
   */
  // TODO: Improve this implementation. Perhaps by moving `RemoteRecorder`s into
  // the `GuestPeer` class.
  private peerRecorderIDs = new WeakMap<Peer, string>();

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
   *
   * If `stopRecording()` or `startRecording()` is called before this method
   * resolves then we will silently discard the recording created by this method
   * without ever starting it.
   */
  public async startRecording(): Promise<void> {
    if (this.recording !== null) {
      throw new Error('Already recording.');
    }
    // Create the recording instance.
    const recording = new PersistRecording();
    // Store our new `Recording` instance on the class. Setting the recording to
    // `this.recording` is critical not just because we will need to access
    // `recording` later, but because it acts as a cancellation method. We want
    // to allow calling `stopRecording()` or `startRecording()` to cancel any
    // pending `startRecording()` calls. To implement this cancellation after
    // every `await` we add the following code:
    //
    // ```
    // if (this.recording !== recording) {
    //   return;
    // }
    // ```
    //
    // If `startRecording()` or `stopRecording()` are called while one of our
    // `await`s are resolving then `this.recording` will change. Therefore, if
    // `this.recording` changed that means we were cancelled.
    this.recording = recording;
    try {
      // If we don’t currently have a local recorder or the local recorder that
      // we have was stopped then create a new one.
      if (this.localRecorder === null || this.localRecorder.stopped === true) {
        this.localRecorder = new LocalRecorder({
          name: this.currentLocalState.name,
          stream: this.currentLocalStream,
        });
      }
      // Add the local recorder to the recording.
      recording.addRecorder(this.localRecorder);
      // Add a recorder for all of the current peers to the recording. We will
      // wait for all of the recorders of the current peers to be created, but
      // we will not wait for any other peers that get added after
      // `startRecording()` is called.
      await Promise.all(this.currentPeers.toArray().map(async peer => {
        // Create the recorder.
        const recorder = await this.createPeerRecorder(peer);
        // Add the recorder and save the id we were given.
        const id = recording.addRecorder(recorder);
        // Set the id in a peer recorders map.
        this.peerRecorderIDs.set(peer, id);
      }));
    } catch (error) {
      // If we were not cancelled then we want to update the `recording`
      // property to null.
      if (this.recording === recording) {
        this.recording = null;
      }
      throw error;
    }
    // Check to make sure we weren’t cancelled.
    if (this.recording !== recording) {
      return;
    }
    // Start recording!
    await recording.start();
  }

  /**
   * Stop recording audio from all of our peers.
   *
   * If `startRecording()` was called, but it has not resolved then calling
   * `stopRecording()` will silently cancel that `startRecording()` call.
   */
  public async stopRecording(): Promise<void> {
    if (this.recording === null) {
      throw new Error('Not already recording.');
    }
    // If the recording was started then stop it.
    if (this.recording.started === true) {
      await this.recording.stop();
    }
    // Set the recording instance to null.
    this.recording = null;
  }

  /**
   * Creates a recorder instance for the provided peer.
   */
  private async createPeerRecorder(peer: Peer): Promise<RemoteRecorder> {
    // Create the channel with a random label. We use a random label to ensure
    // that all the data channels we create are distinct.
    const channel = peer.connection.createDataChannel(`recording:${uuid()}`);
    // Create a new recorder. Don’t wait for it to finish construction.
    const recorder = await RemoteRecorder.create(channel);
    // Return the recorder.
    return recorder;
  }

  /**
   * Creates a peer and also tries to create a recorder for the peer and add it
   * to the current `recording`.
   */
  protected createPeer(address: string, isLocalInitiator: boolean): GuestPeer {
    // Create the peer using the implementation in our super class.
    const peer = super.createPeer(address, isLocalInitiator);
    // If we have a recording then we will want to create a recorder for this
    // peer and add it to the recorder.
    if (this.recording !== null) {
      // Get the recording instance before we do async work.
      const recording = this.recording;
      // Then try to create a peer recorder.
      this.createPeerRecorder(peer)
        .then(
          // If we got a recorder back then we want to add that recorder to
          // the recording if the recording has not changed and our peer has not
          // closed.
          recorder => {
            if (this.recording === recording && peer.isClosed === false) {
              const id = recording.addRecorder(recorder);
              this.peerRecorderIDs.set(peer, id);
            }
          },
          // If we failed to get a recorder then we need to stop the recording.
          // We also re-throw the error so it can be handled by the catch below.
          error => {
            if (this.recording === recording) {
              this.stopRecording();
              throw error;
            }
          },
        )
        // Finally, if we catch an error then report it.
        .catch(error => {
          console.error(error);
        });
    }
    return peer;
  }

  /**
   * Delete a peer and also delete its recorder from the recording.
   */
  protected deletePeer(address: string, peer: GuestPeer): void {
    super.deletePeer(address, peer);
    // If we have a recording then delete the recorder for this peer.
    if (this.recording !== null && this.peerRecorderIDs.has(peer)) {
      const id = this.peerRecorderIDs.get(peer)!;
      this.recording.removeRecorder(id);
    }
  }

  /**
   * Sets the local stream and updates our recorder.
   */
  public setLocalStream(stream: MediaStream): void {
    super.setLocalStream(stream);
    if (this.localRecorder !== null) {
      this.localRecorder.setStream(stream);
    }
  }

  /**
   * Unsets the local stream and updates our recorder.
   */
  public unsetLocalStream(): void {
    super.unsetLocalStream();
    if (this.localRecorder !== null) {
      this.localRecorder.unsetStream();
    }
  }
}
