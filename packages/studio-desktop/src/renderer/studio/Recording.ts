import { v4 as uuid } from 'uuid';
import { Disposable } from '@decode/js-utils';
import {
  PeersMesh,
  Peer,
  LocalRecorder,
  RemoteRecorder,
} from '@decode/studio-core';
import { RecordingDirectoryStorage } from '../shared/storage/RecordingDirectoryStorage';
import { RecordingStorage } from '../shared/storage/RecordingStorage';

/**
 * Represents a recording while it happens. Responsible for watching a
 * `PeersMesh` and persisting any local or remote audio to our storage.
 */
export class Recording {
  /**
   * Starts a recording and returns the instance for the recording that was
   * started. A new recording with a random id will be created in the provided
   * directory storage and we will immeadiately start recording the peers in the
   * provided mesh.
   */
  public static async start(
    directory: RecordingDirectoryStorage,
    mesh: PeersMesh,
  ): Promise<Recording> {
    // Create the storage for this recording.
    const storage = await directory.createRecording();
    // Return a new recording instance using the private constructor.
    return new Recording({
      storage,
      mesh,
    });
  }

  private internalStopped = false;

  /**
   * Whether or not this recording has been stopped.
   */
  public get stopped(): boolean {
    return this.internalStopped;
  }

  /**
   * The storage instance in which we place all of the data for this recording.
   */
  private readonly storage: RecordingStorage;

  /**
   * All of the disposables which we should dispose when the recording stops.
   * Inside this disposables array we will put disposables that stop recorders
   * and
   */
  private readonly disposables: Array<Disposable> = [];

  /**
   * A map of peers to disposables
   */
  private readonly peerDisposables = new Map<Peer, Disposable>();

  private constructor({
    storage,
    mesh,
  }: {
    storage: RecordingStorage;
    mesh: PeersMesh;
  }) {
    this.storage = storage;
    // Setup our local recorder based instance off of the information provided
    // in our mesh and start recording that recorder persisting it to a
    // `RecorderRawStorage` instance.
    {
      // Create a new `LocalRecorder` instance.
      const localRecorder = new LocalRecorder({
        name: mesh.currentLocalState.name,
        context: mesh.localAudioContext,
        audio: mesh.currentLocalAudio,
      });
      // Subscribe to the local audio and whenever it changes we want to update
      // the audio in our `LocalRecorder` with the change.
      const subscription = mesh.localAudio.subscribe(audio => {
        if (audio === null) {
          localRecorder.unsetAudio();
        } else {
          localRecorder.setAudio(audio);
        }
      });
      // Add a disposable which just unsubscribes from the local audio
      // subscription.
      this.disposables.push({
        dispose: () => subscription.unsubscribe(),
      });
      // Write our recorder to the `RecordingStorage` and store the returned
      // disposable so that it will be disposed when we stop the recording.
      this.disposables.push(this.storage.writeRecorder(localRecorder));
    }
    // Make sure that we create a recorder for every peer and add it to our
    // recording. Start by looping through all of the current peers and then add
    // an event listener.
    {
      // Add all of the current peers.
      for (const peer of mesh.currentPeers.values()) {
        this.addPeer(peer);
      }
      // Listen to the add peer and delete peer events and update our internal
      // recording state appropriately when these events happen.
      this.disposables.push(
        Disposable.concat(
          mesh.on('addPeer', ({ peer }) => this.addPeer(peer)),
          mesh.on('deletePeer', ({ peer }) => this.deletePeer(peer)),
        ),
      );
    }
  }

  /**
   * Stops the recording and cleans up any resources we may have created.
   *
   * If the recording has already been stopped then this will throw an error.
   */
  public stop(): void {
    // State check.
    if (this.stopped === true) {
      throw new Error('Already stopped.');
    }
    // Flip internal stopped flag.
    this.internalStopped = true;
    // Dispose all of our disposables now that we have finished.
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    // Dispose all of our disposables from the peer disposables map now that we
    // have finished.
    for (const disposable of this.peerDisposables.values()) {
      disposable.dispose();
    }
  }

  /**
   * Tries to asynchronously add a peer to the recording. If we fail to add the
   * peer to the recording we will log an error and kick the peer from the room.
   *
   * This method returns synchronously but its effects will only be realized
   * asynchronously.
   *
   * This method cannot be called if we don’t have a recording.
   */
  private addPeer(peer: Peer): void {
    this.addPeerAsync(peer).catch(error => {
      // TODO: Kick the peer from the room.
      console.error(error);
    });
  }

  /**
   * Asynchronously adds a peer to the recording on our class instance. If the
   * peer closes before we can finish then nothing further will happen.
   *
   * This method cannot be called if we don’t have a recording.
   */
  private async addPeerAsync(peer: Peer): Promise<void> {
    // If we already have a peer for the disposable then we want to throw an
    // error.
    if (this.peerDisposables.has(peer)) {
      throw new Error('Peer has already been added.');
    }
    // Create the channel with a random label. We use a random label to ensure
    // that all the data channels we create are distinct.
    const channel = peer.connection.createDataChannel(`recording:${uuid()}`);
    // Create a new recorder and wait for it to finish construction. If an error
    // is thrown while we wait for it to construct then we want to catch that
    // error. If the peer is closed then we should discard that error. We don’t
    // care about it now that the peer is gone. Otherwise re-throw the error.
    let recorder: RemoteRecorder;
    try {
      recorder = await RemoteRecorder.create(channel);
    } catch (error) {
      // If our peer has closed then we can ignore this error.
      if (peer.isClosed === true) {
        return;
      }
      throw error;
    }
    // Make sure that the recording did not change stop since we started. Also
    // make sure that the peer has not been closed.
    if (this.stopped === true || peer.isClosed === true) {
      // Cleanup our recorder instance.
      recorder.stop();
      return;
    }
    // Start writing the recorder and save the disposable for later.
    this.peerDisposables.set(peer, this.storage.writeRecorder(recorder));
  }

  /**
   * Synchronously deletes a peer from the recording.
   */
  private deletePeer(peer: Peer): void {
    // If we have a disposable for this peer then let us dispose it then remove
    // it from the map.
    if (this.peerDisposables.has(peer)) {
      this.peerDisposables.get(peer)!.dispose();
      this.peerDisposables.delete(peer);
    }
  }
}
