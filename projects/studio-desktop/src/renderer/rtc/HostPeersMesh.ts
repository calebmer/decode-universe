import { v4 as uuid } from 'uuid';
import { BehaviorSubject } from 'rxjs';
import {
  PeersMesh,
  Peer,
  LocalRecorder,
  RemoteRecorder,
} from '@decode/studio-core';
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
   * The internal `BehaviorSubject` representing the mesh’s recording state.
   */
  private readonly recordingStateSubject =
    new BehaviorSubject(HostPeersMesh.RecordingState.inactive);

  /**
   * The current recording state of our peer mesh. We start at `inactive` and
   * then move through the different stages as actions are fired.
   */
  public readonly recordingState = this.recordingStateSubject.asObservable();

  /**
   * If we are currently recording then this is the `PersistRecording` instance
   * that is doing all of the recording heavy work.
   */
  private recording: PersistRecording | null = null;

  /**
   * The recorder that we use to record our local audio. This may be used
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
    localAudioContext,
    localState,
  }: {
    roomName: string,
    localAudioContext: AudioContext,
    localState: Peer.State,
  }) {
    super({
      roomName,
      localAudioContext,
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
    // At this point we begin the loading phase of our mesh’s recording state.
    this.recordingStateSubject.next(HostPeersMesh.RecordingState.starting);
    try {
      // If we don’t currently have a local recorder or the local recorder that
      // we have was stopped then create a new one.
      if (this.localRecorder === null || this.localRecorder.stopped === true) {
        this.localRecorder = new LocalRecorder({
          name: this.currentLocalState.name,
          context: this.localAudioContext,
          audio: this.currentLocalAudio,
        });
      }
      // Add the local recorder to the recording.
      recording.addRecorder(this.localRecorder);
      // Add a recorder for all of the current peers to the recording.
      for (const peer of this.currentPeers.values()) {
        this.tryAddingPeerToRecording(peer);
      }
    } catch (error) {
      // If we were not cancelled then we want to update the `recording`
      // property to null.
      if (this.recording === recording) {
        this.recording = null;
      }
      throw error;
    }
    // Start recording!
    await recording.start();
    // Add an artificial half second delay before we resolve. If users wait
    // about half a second before things start then we can guarantee no audio
    // will be accidently missed and we will hopefully have started getting
    // audio from guests by 500ms.
    await new Promise(resolve => setTimeout(() => resolve(), 500));
    // We have sucesfully started recording!
    this.recordingStateSubject.next(HostPeersMesh.RecordingState.recording);
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
    // We have stopped the recording. Our state is now inactive.
    this.recordingStateSubject.next(HostPeersMesh.RecordingState.inactive);
  }

  /**
   * Creates a peer and also tries to create a recorder for the peer and add it
   * to the current `recording`.
   */
  protected createPeer(address: string, isLocalInitiator: boolean): GuestPeer {
    // Create the peer using the implementation in our super class.
    const peer = super.createPeer(address, isLocalInitiator);
    // If we have a recording then we will want to try creating a recorder for
    // this peer and add it to the recorder.
    if (this.recording !== null) {
      this.tryAddingPeerToRecording(peer);
    }
    return peer;
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
  private tryAddingPeerToRecording(peer: GuestPeer): void {
    this.addPeerToRecording(peer)
      .catch(error => {
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
  private async addPeerToRecording(peer: GuestPeer): Promise<void> {
    // Destructure the class recording instance at the top so that we can keep a
    // reference even if it changes on `this`.
    const { recording } = this;
    // If there is no recording
    if (recording === null) {
      throw new Error(
        'Cannot add peer to recording when there is no recording.',
      );
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
    // Make sure that the recording did not change since when we first called
    // the function. Also make sure that the peer has not been closed.
    if (this.recording !== recording || peer.isClosed === true) {
      // Cleanup our recorder instance.
      recorder.stop();
      return;
    }
    // Add the recorder and save its id.
    const id = recording.addRecorder(recorder);
    // Set the recorder id in our peer recorder ids map.
    this.peerRecorderIDs.set(peer, id);
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
   * Sets the local audio and updates our recorder.
   */
  public setLocalAudio(audio: AudioNode): void {
    super.setLocalAudio(audio);
    if (this.localRecorder !== null && this.localRecorder.stopped === false) {
      this.localRecorder.setAudio(audio);
    }
  }

  /**
   * Unsets the local audio and updates our recorder.
   */
  public unsetLocalAudio(): void {
    super.unsetLocalAudio();
    if (this.localRecorder !== null && this.localRecorder.stopped === false) {
      this.localRecorder.unsetAudio();
    }
  }
}

export namespace HostPeersMesh {
  /**
   * The recording state that our host peers mesh may be in.
   */
  export enum RecordingState {
    /**
     * No recording is currently happening.
     */
    inactive,
    /**
     * We are currently starting a recording, but the recording has not started
     * just yet!
     */
    starting,
    /**
     * We are currently recording the guest peers.
     */
    recording,
  }
}
