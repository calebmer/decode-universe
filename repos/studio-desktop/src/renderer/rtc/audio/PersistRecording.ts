import * as fs from 'fs';
import { v4 as uuid } from 'uuid';
import { Recorder } from '@decode/studio-ui';
import { RecordingManifest } from './RecordingManifest';

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
   * The path to the manifest JSON file.
   */
  private readonly manifestFilePath =
    `${this.recordingDirectory}/manifest.json`;

  /**
   * The directory in which we will place all of our raw files which are a
   * result of the `Recorder` stream.
   */
  private readonly recordersRawDirectory = `${this.recordingDirectory}/raw`;

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
   * A map of disposables by the id to the `Disposable`. This map will have
   * the same ids as `recorders`, and each disposable will correspond to the
   * `Recorder` with the same id in `recorders`.
   */
  private readonly disposables = new Map<string, Disposable>();

  /**
   * Starts persisting all of our recorders. It also starts an recorders which
   * have not been started before.
   *
   * Throws an error if the recording has been started or stopped before.
   */
  public async start(): Promise<void> {
    // State check.
    if (
      this.started === true ||
      this.stopped === true
    ) {
      throw new Error('Already started.');
    }
    // Setup the file system.
    await this.setupFileSystem();
    // Write the manifest to disk.
    await this.updateManifest();
    // Flip the `started` flag.
    this.internalStarted = true;
    // For all of our recorders.
    for (const [id, recorder] of this.recorders) {
      // Start persisting the recorder and save the disposable for later.
      this.disposables.set(
        id,
        persistRecorder(`${this.recordersRawDirectory}/${id}`, recorder),
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
  public async stop(): Promise<void> {
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
    // Dispose all of our disposables that are currently persisting the recorder
    // streams to disk.
    for (const [, disposable] of this.disposables) {
      disposable.dispose();
    }
    // Clear our maps. We won’t be using them anymore.
    this.recorders.clear();
    this.disposables.clear();
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
    // If we have started then we need to start persisting the recorder
    // immeadiately!
    if (this.started === true) {
      // Add a disposable for our persistance operation.
      this.disposables.set(
        id,
        persistRecorder(`${this.recordersRawDirectory}/${id}`, recorder),
      );
      // If the recorder has not started then we want to start it.
      if (recorder.started === false) {
        recorder.start();
      }
      // If we have started then we want to try and update the manifest now that
      // we have added a recorder.
      //
      // If it fails then lets report the error.
      this.updateManifest().catch(error => console.error(error));
    }
    // Add the recorder to our map.
    this.recorders.set(id, recorder);
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
    // If have started, but not yet stopped then we have a disposable for the
    // persistance of this recorder that we need to dispose and delete.
    if (this.started === true && this.stopped === false) {
      const disposable = this.disposables.get(id)!;
      disposable.dispose();
      this.disposables.delete(id);
    }
    // If the recorder has started, but not yet stopped, then we want to stop
    // the recorder ourselves.
    if (recorder.started === true && recorder.stopped === false) {
      recorder.stop();
    }
  }

  /**
   * Sets up the file system by making the directories in which we will place
   * our recording.
   */
  private async setupFileSystem(): Promise<void> {
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
        this.recordersRawDirectory,
        error => error ? reject(error) : resolve(),
      );
    });
  }

  /**
   * Updates the manifest file for this recording on disk.
   */
  private async updateManifest(): Promise<void> {
    // Create a new map of recorders.
    const currentRecorders: RecordingManifest['recorders'] = {};
    // For every recorder that we have add an entry to the `recorders` map we
    // will use in our manifest.
    for (const [id, recorder] of this.recorders) {
      currentRecorders[id] = {
        name: recorder.name,
        sampleRate: recorder.sampleRate,
      };
    }
    // Check to see if a manifest file already exists.
    const manifestExists = await new Promise<boolean>(resolve => {
      fs.exists(
        this.manifestFilePath,
        exists => resolve(exists),
      );
    });
    // The manifest variable that we will fill in the following.
    let nextManifest: RecordingManifest;
    // If a manifest file already exists then we want to read that file and
    // *update* it instead of replacing it. This allows us to retain metadata
    // for recorders that have been removed. We will still want to keep their
    // recordings, however.
    if (manifestExists === true) {
      // Read the file and into this string variable.
      const previousManifestString =
        await new Promise<string>((resolve, reject) => {
          fs.readFile(
            this.manifestFilePath,
            'utf8',
            (error, result) => error ? reject(error) : resolve(result),
          );
        });
      // Parse the manifest which was serialized into JSON.
      const previousManifest: RecordingManifest =
        JSON.parse(previousManifestString);
      // Create the next manifest object which is a clone of the previous
      // manifest, but with the new recorders.
      nextManifest = {
        ...previousManifest,
        recorders: {
          ...previousManifest.recorders,
          ...currentRecorders,
        },
      };
    } else {
      // Just create a fresh new manifest.
      nextManifest = {
        version: '1',
        recorders: currentRecorders,
      };
    }
    // Stringify the next manifest and pretty print the resulting JSON with two
    // spaces.
    const nextManifestString = JSON.stringify(nextManifest, null, 2);
    // Write the manifest back to the file system.
    await new Promise((resolve, reject) => {
      fs.writeFile(
        `${this.recordingDirectory}/manifest.json`,
        nextManifestString,
        error => error ? reject(error) : resolve(),
      );
    });
  }
}

/**
 * Persists a recorder to the disk by appending the recorder’s streamed data to
 * the file at the provided path.
 */
function persistRecorder(
  filePath: string,
  recorder: Recorder,
): Disposable {
  // Keep track of whether or not we have ended the writable stream.
  let ended = false;
  // Creates a write stream for the provided file path.
  const writable = fs.createWriteStream(filePath);
  // TODO: Better error reporting.
  writable.on('error', (error: Error) => {
    console.error(error);
  });
  // Subscribe to the recorder’s stream and whenever we get data then write it
  // to the file writable stream.
  const subscription = recorder.stream.subscribe({
    // Convert our `ArrayBuffer` to a Node.js buffer and write it to the file’s
    // write stream
    next: buffer => writable.write(Buffer.from(buffer)),
    // TODO: Better error reporting.
    error: error => console.error(error),
    // Once the stream finishes then we want to end the write stream.
    complete: () => {
      ended = true;
      writable.end();
    },
  });
  return {
    // Dispose by unsubscribing from the subscription and ending the writable
    // stream if we have not already ended it.
    dispose: () => {
      subscription.unsubscribe();
      // If we have not yet ended the stream then end it here.
      if (ended === false) {
        writable.end();
      }
    },
  };
}
