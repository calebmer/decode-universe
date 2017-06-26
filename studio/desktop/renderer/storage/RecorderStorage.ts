import { createWriteStream } from 'fs';
import Disposable from '~/utils/universal/Disposable';
import Recorder from '~/studio/core/rtc/audio/Recorder';
import * as fs from './FileSystemUtils';

/**
 * Stores the data from a single `Recorder`.
 */
export default class RecorderStorage {
  /**
   * Open an instance of `RecorderRawStorage`. Unlike many other storages the
   * storage for a recorder does not have to be created first. Calling `write()`
   * will create a new file in the directory, or overwrite any file currently at
   * the provided `filePath`.
   *
   * It can also be opened synchronously.
   */
  public static open(
    rawFilePath: string,
    options: { name: string; sampleRate: number; startedAtDelta: number },
  ): RecorderStorage {
    return new RecorderStorage({ ...options, rawFilePath });
  }

  /**
   * The file at which this recorder lives.
   */
  public readonly rawFilePath: string;

  /**
   * The name of the recorder.
   */
  public readonly name: string;

  /**
   * The sample rate at which this recorder is recorded.
   */
  public readonly sampleRate: number;

  /**
   * How long after the recording started did this recorder start (in
   * milliseconds).
   */
  public readonly startedAtDelta: number;

  private constructor({
    rawFilePath,
    name,
    sampleRate,
    startedAtDelta,
  }: {
    rawFilePath: string;
    name: string;
    sampleRate: number;
    startedAtDelta: number;
  }) {
    this.rawFilePath = rawFilePath;
    this.name = name;
    this.sampleRate = sampleRate;
    this.startedAtDelta = startedAtDelta;
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
    const writable = createWriteStream(this.rawFilePath);
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
    return fs.fileByteSize(this.rawFilePath);
  }

  /**
   * Get the sample length of the recorder data.
   */
  public getSampleLength(): Promise<number> {
    return this.getByteLength().then(length => length / 4);
  }
}
