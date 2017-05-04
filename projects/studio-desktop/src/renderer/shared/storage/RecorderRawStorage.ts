import { createWriteStream } from 'fs';
import { Disposable } from '@decode/jsutils';
import { Recorder } from '@decode/studio-core';
import { FileSystemUtils as fs } from './FileSystemUtils';

/**
 * Stores the data from a single `Recorder`.
 */
export class RecorderRawStorage {
  /**
   * Open an instance of `RecorderRawStorage`. Unlike many other storages the
   * storage for a recorder does not have to be created first. Calling `write()`
   * will create a new file in the directory, or overwrite any file currently at
   * the provided `filePath`.
   *
   * It can also be opened synchronously.
   */
  public static open(filePath: string): RecorderRawStorage {
    return new RecorderRawStorage({ filePath });
  }

  /**
   * The file at which this recorder lives.
   */
  private readonly filePath: string;

  private constructor({
    filePath,
  }: {
    filePath: string,
  }) {
    this.filePath = filePath;
  }

  /**
   * Stores the recorder’s hot stream.
   */
  public write(recorder: Recorder): Disposable {
    // Start the recorder if it has not already been started.
    if (recorder.started === false) {
      recorder.start();
    }
    // Creates a write stream for the provided file path.
    const writable = createWriteStream(this.filePath);
    // TODO: Better error reporting.
    writable.on('error', (error: Error) => {
      console.error(error);
    });
    // Watch for data from the recorder and whenever we get data then write it
    // to the file writable stream.
    const disposable = recorder.on('data', buffer => {
      // Convert our `ArrayBuffer` to a Node.js buffer and write it to the
      // file’s write stream.
      writable.write(Buffer.from(buffer));
    });
    return {
      // Dispose by unsubscribing from the subscription and ending the writable
      // stream if we have not already ended it.
      dispose: () => {
        // Stop listing for data from the recorder.
        disposable.dispose();
        // End the writable stream.
        writable.end();
        // Stop the recorder if it has not already been stopped.
        if (recorder.stopped === false) {
          recorder.stop();
        }
      },
    };
  }

  /**
   * Get the byte length of the raw recorder data.
   */
  public getByteLength(): Promise<number> {
    return fs.fileByteSize(this.filePath);
  }

  /**
   * Get the sample length of the recorder data.
   */
  public getSampleLength(): Promise<number> {
    return this.getByteLength().then(length => length / 4);
  }

  // TODO: public read() {}
}
