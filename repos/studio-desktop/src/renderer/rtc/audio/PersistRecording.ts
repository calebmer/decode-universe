import * as fs from 'fs';
import { v4 as uuid } from 'uuid';
import { Subscription } from 'rxjs';
import { Recorder } from '@decode/studio-ui';

/**
 * The directory in which we store all of the source files for our recordings.
 * For now its a constant, but in the future it may be configurable.
 */
const recordingsDirectory = '/Users/calebmer/Desktop/recordings';

/**
 * Aggregates any number of `Recorder`s and persists their streams to the disk
 * as sthey are published.
 */
export class PersistRecording {
  /**
   * The unique identifier of the recording.
   */
  private readonly id = uuid();

  /**
   * The root directory for this recording.
   */
  private readonly recordingDirectory = `${recordingsDirectory}/${this.id}`;

  /**
   * The directory in which we will place all of our raw files which are a
   * result of the `Recorder` stream.
   */
  private readonly recordersDirectory = `${this.recordingDirectory}/raw`;

  private internalStarted = false;
  private internalStopped = false;

  /**
   * A state flag that switches to true when `start()` is called.
   */
  public get started(): boolean {
    return this.internalStarted;
  }

  /**
   * A state flag that switches to true when `stop()` is called.
   */
  public get stopped(): boolean {
    return this.internalStopped;
  }

  /**
   * A map of recorders by their assigned id to the `Recorder` instance.
   */
  private readonly recorders = new Map<string, Recorder>();

  /**
   * A map of subscriptions by the id to the `Subscription`. This map will have
   * the same ids as `recorders`, and each subscription will correspond to the
   * `Recorder` with the same id in `recorders`.
   */
  private readonly subscriptions = new Map<string, Subscription>();

  /**
   * Sets up the file system by making the directories in which we will place
   * our recording.
   */
  public async setupFileSystem(): Promise<void> {
    // Makes the root recording directory.
    await new Promise<void>((resolve, reject) => {
      fs.mkdir(
        this.recordingDirectory,
        error => error ? reject(error) : resolve(),
      );
    });
    // Makes the directory where we will stream the results of all our
    // recorders.
    await new Promise<void>((resolve, reject) => {
      fs.mkdir(
        this.recordersDirectory,
        error => error ? reject(error) : resolve(),
      );
    });
  }

  /**
   * Starts persisting all of our recorders. It also starts an recorders which
   * have not been started before.
   *
   * Throws an error if the recording has been started or stopped before.
   */
  public start(): void {
    // State check.
    if (
      this.started === true ||
      this.stopped === true
    ) {
      throw new Error('Already started.');
    }
    // Flip the `started` flag.
    this.internalStarted = true;
    // For all of our recorders.
    for (const [id, recorder] of this.recorders) {
      // Start persisting the recorder and save the subscription for later.
      this.subscriptions.set(
        id,
        persistRecorder(`${this.recordersDirectory}/${id}`, recorder),
      );
      // If the recorder has not been started before then we want to start it.
      if (recorder.started === false) {
        recorder.start();
      }
    }
  }

  /**
   * Stops persisting all of the recordings. Stops any recorders which have not
   * already been stopped.
   *
   * Throws an error if the recording has already been stopped.
   */
  public stop(): void {
    // State check.
    if (this.stopped === true) {
      throw new Error('Already stopped.');
    }
    // Flip the `stopped` flag.
    this.internalStopped = true;
    // For all of our recorders.
    for (const [, recorder] of this.recorders) {
      // If the recorder hasn’t already stopped then we want to stop it.
      if (recorder.stopped === false) {
        recorder.stop();
      }
    }
    // Unsubscribe from all of our subscriptions that are currently persisting
    // the recorder streams to disk.
    for (const [, subscription] of this.subscriptions) {
      subscription.unsubscribe();
    }
    // Clear our maps. We won’t be using them anymore.
    this.recorders.clear();
    this.subscriptions.clear();
  }

  /**
   * Adds a recorder that we want to persist. Returns a unique identifier that
   * we can use to remove the recorder later.
   *
   * If we have started the recording, but this recorder has not been started
   * then it will be started.
   *
   * If we have stopped the recording then an error will be thrown.
   */
  public addRecorder(recorder: Recorder): string {
    // State check.
    if (this.stopped === true) {
      throw new Error('Recording has stopped.');
    }
    // Generate the unique identifier for this recorder.
    const id = uuid();
    // Add the recorder to our map.
    this.recorders.set(id, recorder);
    // If we have started then we need to start persisting the recorder
    // immeadiately!
    if (this.started === true) {
      // Add a subscription for our persistance operation.
      this.subscriptions.set(
        id,
        persistRecorder(`${this.recordersDirectory}/${id}`, recorder),
      );
      // If the recorder has not started then we want to start it.
      if (recorder.started === false) {
        recorder.start();
      }
    }
    // Return the id we created.
    return id;
  }

  /**
   * Stops persisting a recorder as identified by the provided id. Does not
   * delete any persisted data, but will prevent any further data to be written
   * for the given recorder.
   *
   * If the recorder has started, but it has not been stopped then we will stop
   * it.
   *
   * If the recording has stopped, but this method gets called then an error
   * will be thrown.
   *
   * If no recorder for the provided id exists then this method will perform no
   * operation.
   */
  public removeRecorder(id: string): void {
    // State check.
    if (this.stopped === true) {
      throw new Error('Recording has stopped.');
    }
    // If we do not have a recorder for the given id then don’t continue.
    if (!this.recorders.has(id)) {
      return;
    }
    // Get the recorder for this id.
    const recorder = this.recorders.get(id)!;
    // Delete the recorder from our internal map.
    this.recorders.delete(id);
    // If have started, but not yet stopped then we have a subscription to the
    // persistance of this recorder that we need to unsubscribe and delete.
    if (this.started === true && this.stopped === false) {
      const subscription = this.subscriptions.get(id)!;
      subscription.unsubscribe();
      this.subscriptions.delete(id);
    }
    // If the recorder has started, but not yet stopped, then we want to stop
    // the recorder ourselves.
    if (recorder.started === true && recorder.stopped === false) {
      recorder.stop();
    }
  }
}

/**
 * Persists a recorder to the disk by appending the recorder’s streamed data to
 * the file at the provided path.
 */
function persistRecorder(
  filePath: string,
  recorder: Recorder,
): Subscription {
  return recorder.stream.subscribe({
    next: buffer => {
      // Append the data to the provided file.
      fs.appendFile(
        filePath,
        // Convert the stream buffer data to a Node.js `Buffer`.
        Buffer.from(buffer),
        error => {
          if (error) {
            // TODO: Better error handling?
            console.error(error);
          }
        },
      );
    },
    // TODO: Better error reporting.
    error: error => console.error(error),
  });
}
