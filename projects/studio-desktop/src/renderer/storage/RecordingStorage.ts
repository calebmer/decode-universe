import * as path from 'path';
import { v4 as uuid } from 'uuid';
import { Disposable } from '@decode/jsutils';
import { Recorder } from '@decode/studio-core';
import { FileSystemUtils as fs } from './FileSystemUtils';
import { RecorderStorage } from './RecorderStorage';

type RecorderMapValue = {
  readonly storage: RecorderStorage,
  readonly manifest: RecorderManifest,
};

const rawRecorderDataDirectoryName = 'raw';

/**
 * The storage interface for a single recording.
 */
export class RecordingStorage {
  /**
   * Opens up a recording storage instance allowing users to read from it.
   */
  public static async open(directoryPath: string): Promise<RecordingStorage> {
    // Get the file path for the manifest.
    const manifestFilePath = path.join(directoryPath, 'manifest.json');
    // Read the manifest file into a string.
    const manifestString = await fs.readFileAsString(manifestFilePath);
    // Parse the manifest into a string.
    const manifest: RecordingManifest = JSON.parse(manifestString);
    // Open all of our recorders.
    const recorders = new Map<string, RecorderMapValue>(await Promise.all(
      Object.keys(manifest.recorders)
        .map(async (id: string): Promise<[string, RecorderMapValue]> => {
          // Create the file path to our raw recorder file.
          const recorderFilePath =
            path.join(directoryPath, rawRecorderDataDirectoryName, id);
          // Get the manifest for this recorder.
          const recorderManifest = manifest.recorders[id];
          // Return a map entry with the id as the key, and the recorder storage
          // as the value.
          return [id, {
            storage: await RecorderStorage.open(recorderFilePath),
            manifest: recorderManifest,
          }];
        })
    ));
    // Use the private constructor to create a new `RecordingStorage` instance.
    return new RecordingStorage({
      directoryPath,
      startedAt: manifest.startedAt,
      recorders,
    });
  }

  /**
   * Creates a new recording storage instance where `startedAt` is the time at
   * which we started to construct the recording storage instance. Make sure
   * that a new recording storage is only created when starting the recording!
   */
  public static async create(directoryPath: string): Promise<RecordingStorage> {
    // Get the time at the start of this method call.
    const startedAt = Date.now();
    // Create the directories we need at the provided paths.
    await fs.createDirectory(directoryPath);
    await fs.createDirectory(path.join(directoryPath, rawRecorderDataDirectoryName));
    // Create the storage instance using the private constructor.
    const storage = new RecordingStorage({
      directoryPath,
      startedAt,
      recorders: new Map(),
    });
    // Write the initial manifest, and wait for it to finish.
    await storage.writeManifest();
    // Return the storage.
    return storage;
  }

  /**
   * The directory path at which this recording lies.
   */
  private readonly directoryPath: string;

  /**
   * The time, in milliseconds since the Unix epoch, at which this recording was
   * started.
   */
  public readonly startedAt: number;

  /**
   * A map of all the recorder storage instances keyed by their ids. Entries are
   * stored in no particular order.
   */
  private readonly recorders: Map<string, RecorderMapValue>;

  private constructor({
    directoryPath,
    startedAt,
    recorders,
  }: {
    directoryPath: string,
    startedAt: number,
    recorders: Map<string, RecorderMapValue>,
  }) {
    this.directoryPath = directoryPath;
    this.startedAt = startedAt;
    this.recorders = recorders;
  }

  /**
   * Writes the manifest to the file system overwriting any manifest that was
   * there previously.
   */
  private async writeManifest(): Promise<void> {
    // Create a map of recorder ids to their manifest.
    const recorders: { [id: string]: RecorderManifest } = {};
    // For all of our recorders add an entry to the recorder map with the
    // manifest as the value.
    for (const [id, { manifest }] of this.recorders) {
      recorders[id] = manifest;
    }
    // Create the full manifest.
    const manifest: RecordingManifest = {
      startedAt: this.startedAt,
      recorders,
    };
    // Write the manfiest file to the file system.
    await fs.writeFile(
      // We want to write our manifest to the manifest file path.
      path.join(this.directoryPath, 'manifest.json'),
      // Stringify the manifest when writing it. If we are in development then
      // we want to pretty print the JSON with 2 space indentation for easy
      // debugging.
      JSON.stringify(manifest, null, DEV ? 2 : undefined),
    );
  }

  /**
   * Writes a recorder stream to a new `RecorderStorage` instance.
   *
   * The returned disposable will cancel the write.
   */
  public writeRecorder(recorder: Recorder): Disposable {
    // Randomly generate an id for this recorder in the storage system.
    const id = uuid();
    // Open a new `RecorderStorage` instance a a fresh path.
    const storage = RecorderStorage.open(
      // Create a path for a file in the `recorders` directory with the randomly
      // generated uuid.
      path.join(this.directoryPath, rawRecorderDataDirectoryName, id),
    );
    // Add the recorder to our map.
    this.recorders.set(id, {
      storage,
      manifest: {
        name: recorder.name,
        sampleRate: recorder.sampleRate,
        startedAtDelta: Date.now() - this.startedAt,
      },
    });
    // Try to write the manifest which was updated above. If that fails then we
    // want to report an error.
    this.writeManifest().catch(error => console.error(error));
    // Write the recorder stream to the newly created storage and return the
    // disposable for that.
    return storage.write(recorder);
  }

  /**
   * Returns all of the recorders for this recording in no particular order.
   * The id for each recorder is also provided.
   */
  public getAllRecorders(): Array<{
    id: string,
    recorder: RecorderStorage,
  }> {
    return Array.from(this.recorders)
      .map(([id, { manifest, storage }]) => ({
        ...manifest,
        id,
        recorder: storage,
      }));
  }
}

/**
 * The manifest type represents a file which contains metadata for all of the
 * audio files that are a part of our recording. The format must be serializable
 * to and deserializable from JSON.
 */
type RecordingManifest = {
  /**
   * The time in millseconds since the Unix epoch at which the recording was
   * started.
   */
  readonly startedAt: number,
  /**
   * A map of recorder ids to metadata about that recorder. The `id` key will
   * correspond to the file name of the recorder on disk.
   */
  readonly recorders: {
    readonly [id: string]: RecorderManifest,
  },
};

/**
 * The type for a single entry that can be found in the recording manifest.
 */
type RecorderManifest = {
  /**
   * A human readable name for this recorder.
   */
  readonly name: string,
  /**
   * The sample rate at which the audio was recorded.
   */
  readonly sampleRate: number,
  /**
   * The time in milliseconds at which the recorder started *after* the
   * recording started. So if the recorder started at the same time as the
   * recording this value would be 0. If the recorder started 5 seconds after
   * the recording started this value would be 5000.
   *
   * Add this nomber to `recordedAt` to get the milliseconds since the Unix
   * epoch at which this recorder started.
   */
  readonly startedAtDelta: number,
};
