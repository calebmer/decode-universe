import * as fs from 'fs';
import * as stream from 'stream';
import { RecordingManifest } from './RecordingManifest';

async function exportWAV(recordingDirectory: string): Promise<void> {
  const manifestFilePath = `${recordingDirectory}/manifest.json`;
  const rawDirectory = `${recordingDirectory}/raw`;
  const wavDirectory = `${recordingDirectory}/wav`;
  try {
    await new Promise<void>((resolve, reject) => {
      fs.mkdir(
        wavDirectory,
        error => error ? reject(error) : resolve(),
      );
    });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
  const manifestString = await new Promise<string>((resolve, reject) => {
    fs.readFile(
      manifestFilePath,
      'utf8',
      (error, result) => error ? reject(error) : resolve(result),
    );
  });
  const manifest: RecordingManifest = JSON.parse(manifestString);
  Object.keys(manifest.recorders).map(async id => {
    await exportRecorderToWAV(
      manifest.recorders[id],
      `${rawDirectory}/${id}`,
      `${wavDirectory}/${id}.wav`,
    );
  });
}

export const ExportRecording = {
  exportWAV,
};

/**
 * Exports a recorder’s raw data to a WAV file ready for editing in any audio
 * editor app.
 *
 * The `rawFilePath` should point to the file which the recorder’s `stream` was
 * saved without changes.
 */
async function exportRecorderToWAV(
  recorder: RecordingManifest.Recorder,
  rawFilePath: string,
  wavFilePath: string,
): Promise<void> {
  // Get the stats for our raw file. We don’t want to read it because we are
  // going to stream the file later on. However, we do need to know the size for
  // the WAV file header.
  const stats = await new Promise<fs.Stats>((resolve, reject) => {
    fs.stat(
      rawFilePath,
      (error, stats) => error ? reject(error) : resolve(stats),
    );
  });
  // Create a write stream which we will use to write out the WAV data as we get
  // it.
  const writable = fs.createWriteStream(wavFilePath);
  // Create and write the header for our WAV file. As always, see
  // [`MediaStreamRecorder`][1] for the reference implementation.
  //
  // Some notable differences. Wherever the reference implementation uses
  // `interleaved.length * 2`, we use `stats.size / 2`. This is because
  // `interleaved` is a `Float32Array` where every element has a size of 4
  // bytes. So to get `interleaved`s size in bytes one must do the following:
  // `interleaved.length * 4`. This value will satisfy the equality
  // `stats.size === interleaved.length * 4`. If we divide both sides by 2 we
  // get: `stats.size / 2 === interleaved.length * 2`.
  //
  // Another reference implementation is [`Recorder.js`]. `MediaStreamRecorder`
  // is still maintained so we based our implementation primarily off of that.
  //
  // [1]: https://github.com/streamproc/MediaStreamRecorder/blob/bef0b2082853a6a68c45e3a9e0066d6757ca75c7/MediaStreamRecorder.js#L1203-L1226
  // [2]: https://github.com/mattdiamond/Recorderjs
  {
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    // RIFF chunk descriptor.
    writeUTFBytes(view, 0, 'RIFF');
    view.setUint32(4, 44 + (stats.size / 2) - 8, true); // -8 (via https://github.com/streamproc/MediaStreamRecorder/issues/97)
    writeUTFBytes(view, 8, 'WAVE');
    // FMT sub-chunk
    writeUTFBytes(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    // Mono (1 channel)
    view.setUint16(22, 1, true);
    view.setUint32(24, recorder.sampleRate, true);
    view.setUint32(28, recorder.sampleRate * 1 * 2, true); // numChannels * 2 (via https://github.com/streamproc/MediaStreamRecorder/pull/71)
    view.setUint16(32, 1 * 2, true);
    view.setUint16(34, 16, true);
    // Data sub-chunk
    writeUTFBytes(view, 36, 'data');
    view.setUint32(40, (stats.size / 2), true);
    // Write the header to the write stream.
    writable.write(Buffer.from(header));
  }
  // Create a stream that will read our raw file.
  const readable = fs.createReadStream(rawFilePath);
  // Construct a promise that will resolve or reject once our streams finish.
  await new Promise<void>((resolve, reject) => {
    readable
      // Pipe the readable stream into a `WAVTransform` which will convert the
      // raw data into data appropriate for WAV files.
      .pipe(new WAVTransform())
      // Write the result of the transformed data to our writable.
      .pipe(writable)
      // When we finish or get an error then resolve this promise.
      .on('finish', () => resolve())
      .on('error', (error: Error) => reject(error));
  });
}

/**
 * Writes some UTF bytes from a string to a `DataView` at a given offset.
 */
function writeUTFBytes(view: DataView, offset: number, string: string): void {
  for (var i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * A Node.js transform stream that takes the [`MediaStreamRecorder`s data
 * writing loop][1] and makes it so that it can run on small chunks of data at
 * any given time. This allows us to stream the data instead of having one,
 * giant, blocking `for` loop that iterates through all the data we loaded into
 * memory.
 *
 * [1]: https://github.com/streamproc/MediaStreamRecorder/blob/bef0b2082853a6a68c45e3a9e0066d6757ca75c7/MediaStreamRecorder.js#L1228-L1235
 */
class WAVTransform extends stream.Transform {
  protected _transform(
    data: Buffer,
    encoding: string,
    callback: (error: Error | null, data: Buffer) => void,
  ): void {
    // Don’t know what this does. We should find out...
    let volume = 1;
    // Convert the buffer into a `Float32Array`.
    //
    // TODO: Are there problems with this if `data.buffer.byteLength % 4 !== 0`?
    const array = new Float32Array(data.buffer);
    // Create a new array buffer which is twice as large as the `Float32Array`.
    // This would be half as large as `data.buffer.byteLength`.
    const buffer = new ArrayBuffer(array.length * 2);
    // Create a data view for our buffer.
    const view = new DataView(buffer);
    // For every item in the array we want to add it to our newly constructed
    // array buffer.
    for (let i = 0; i < array.length; i++) {
      view.setInt16(
        i * 2,
        array[i] * (0x7FFF * volume),
        true,
      );
    }
    // Send back the newly constructed buffer.
    callback(null, Buffer.from(buffer));
  }
}
