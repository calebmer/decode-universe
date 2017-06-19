import * as path from 'path';
import { FileSystemUtils as fs } from './FileSystemUtils';
import { RecordingDirectoryStorage } from './RecordingDirectoryStorage';

/**
 * Represents all of the persistent file system storage for the Decode Studio
 * Desktop client. This is the entry point of storage interfaces which support
 * both read and write operations.
 */
export class Storage {
  /**
   * Opens up a storage instance for the provided directory.
   */
  public static async open(directoryPath: string): Promise<Storage> {
    // Create the path for the recordings directory.
    const recordingsDirectory = path.join(directoryPath, 'recordings');
    // Create the recordings directory if it does not already exist.
    if (!await fs.directoryExists(recordingsDirectory)) {
      await fs.createDirectory(recordingsDirectory);
    }
    // Open the recordings directory.
    const directory = await RecordingDirectoryStorage.open(recordingsDirectory);
    // Create a new storage instance using the private constructor.
    return new Storage({
      directory,
    });
  }

  /**
   * The directory of recordings which the user has made.
   */
  public readonly directory: RecordingDirectoryStorage;

  private constructor({ directory }: { directory: RecordingDirectoryStorage }) {
    this.directory = directory;
  }
}
