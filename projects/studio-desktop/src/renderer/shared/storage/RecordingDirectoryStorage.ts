import * as path from 'path';
import { v4 as uuid } from 'uuid';
import { FileSystemUtils as fs } from './FileSystemUtils';
import { RecordingStorage } from './RecordingStorage';

/**
 * A directory of recordings which the user has made.
 *
 * We use the name `RecordingDirectoryStorage` instead of `RecordingsStorage`
 * because the latter is off of `RecordingStorage` by one letter. Too confusing.
 *
 * For now we load all of the recording metadata into memory at once. It may be
 * smarter to, in the future, use pagination so that we only load the visible
 * recordings at once.
 */
export class RecordingDirectoryStorage {
  /**
   * Opens the directory in which all the recordings are supposed to be stored.
   * Opens all of the recordings at once. There may be a better strategy in the
   * future where we can paginate if it turns out that opening everything leads
   * to performance issues.
   */
  public static async open(
    directoryPath: string,
  ): Promise<RecordingDirectoryStorage> {
    // Get all of the directory names at the provided path.
    const recordingNames = await fs.readDirectory(directoryPath);
    // Turn all of those names into `RecordingStorage` objects.
    const recordings = new Map<string, RecordingStorage>(await Promise.all(
      recordingNames
        // If the name starts with a `.` then we want to ignore it. This often
        // happens with `.DS_Store` files on MacOS.
        .filter(name => !name.startsWith('.'))
        // Create the `RecordingStorage` instance and return a promise which
        // will be awaited in parallel.
        .map(async (id: string): Promise<[string, RecordingStorage]> => {
          const recordingDirectory = path.join(directoryPath, id);
          return [id, await RecordingStorage.open(recordingDirectory)];
        })
    ));
    // Construct an instance using the private constructor.
    return new RecordingDirectoryStorage({
      directoryPath,
      recordings,
    });
  }

  /**
   * The directory where the recordings directory lies.
   */
  private readonly directoryPath: string;

  /**
   * All of the `RecordingStorage` instances for the recordings in our
   * directory. The recordings are in no particular order. Each recording is
   * keyed by its id.
   */
  private readonly recordings: Map<string, RecordingStorage>;

  private constructor({
    directoryPath,
    recordings,
  }: {
    directoryPath: string,
    recordings: Map<string, RecordingStorage>,
  }) {
    this.directoryPath = directoryPath;
    this.recordings = recordings;
  }

  /**
   * Creates a new recording with a randomly generated identifier.
   */
  public async createRecording(): Promise<RecordingStorage> {
    // Generate a new id for this recording.
    const id = uuid();
    // Create the recording storage instance.
    const recording =
      await RecordingStorage.create(path.join(this.directoryPath, id));
    // Add the recording to our internal `recordings` map.
    this.recordings.set(id, recording);
    // Return the recording.
    return recording;
  }

  /**
   * Returns all of the recordings in this directory in no particular order.
   * The id for each recording is also provided.
   */
  public getAllRecordings(): ReadonlyMap<string, RecordingStorage> {
    return this.recordings;
  }
}
