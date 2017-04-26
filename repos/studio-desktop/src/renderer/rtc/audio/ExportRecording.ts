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
  // Compute the number of silence samples we will need to add to the start of
  // the output WAV recording. This is computed from the `startedAt` time on our
  // recorder. If it is not 0 then the recorder started a little bit after the
  // recording and we should add silence to pad the output so that all our
  // recordings have a consistent length.
  const silenceSampleSize =
    Math.floor(recorder.sampleRate * (recorder.startedAt / 1000));
  // The final sample size of our recording. It will be the size of our raw file
  // divided by 4.
  const sampleSize = (stats.size / 4) + silenceSampleSize;
  // Create a write stream which we will use to write out the WAV data as we get
  // it.
  const writable = fs.createWriteStream(wavFilePath);
  // Create and write the header for our WAV file. As always, see
  // [`MediaStreamRecorder`][1] for the reference implementation.
  //
  // Another reference implementation is [`Recorder.js`][2].
  // `MediaStreamRecorder` is still maintained so we based our implementation
  // primarily off of that. All of our detailed comments are courtesy of
  // [`Recorder.js`][2], but the implementation is still from
  // `MediaStreamRecorder`.
  //
  // [1]: https://github.com/streamproc/MediaStreamRecorder/blob/bef0b2082853a6a68c45e3a9e0066d6757ca75c7/MediaStreamRecorder.js#L1203-L1226
  // [2]: https://github.com/mattdiamond/Recorderjs
  {
    // Create a header that is large enough to hold our actual header (44 bytes)
    // and the initial silence data (`silenceSampleSize * 2`).
    const header = new ArrayBuffer(44 + silenceSampleSize * 2);
    const view = new DataView(header);
    // RIFF identifier.
    writeUTFBytes(view, 0, 'RIFF');
    // RIFF chunk length.
    view.setUint32(4, 44 + sampleSize * 2 - 8, true); // -8 (via https://github.com/streamproc/MediaStreamRecorder/issues/97)
    // RIFF type.
    writeUTFBytes(view, 8, 'WAVE');
    // Format chunk identifier.
    writeUTFBytes(view, 12, 'fmt ');
    // Format chunk length.
    view.setUint32(16, 16, true);
    // Sample format (raw).
    view.setUint16(20, 1, true);
    // Channel count.
    view.setUint16(22, 1, true);
    // Sample rate.
    view.setUint32(24, recorder.sampleRate, true);
    // Byte rate (sample rate * block align).
    view.setUint32(28, recorder.sampleRate * 1 * 2, true); // numChannels * 2 (via https://github.com/streamproc/MediaStreamRecorder/pull/71)
    // Block align (channel count * bytes per sample).
    view.setUint16(32, 1 * 2, true);
    // Bits per sample.
    view.setUint16(34, 16, true);
    // Data chunk identifier.
    writeUTFBytes(view, 36, 'data');
    // Data chunk length.
    view.setUint32(40, sampleSize * 2, true);
    // Write our initial silence data if there is anything to be written. The
    // length of which is generated by determining at what offset from the
    // initial recording time the recorder joined.
    if (silenceSampleSize > 0) {
      const silenceData = new Float32Array(silenceSampleSize);
      silenceData.fill(0);
      writePCMSamples(view, 44, silenceData);
    }
    // Write the header to the write stream.
    writable.write(Buffer.from(header));
  }
  // Construct a promise that will resolve or reject once our streams finish.
  await new Promise<void>((resolve, reject) => {
    // Create a stream that will read our raw file.
    fs.createReadStream(rawFilePath)
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
 * Uses `writePCMSamples()`.
 *
 * [1]: https://github.com/streamproc/MediaStreamRecorder/blob/bef0b2082853a6a68c45e3a9e0066d6757ca75c7/MediaStreamRecorder.js#L1228-L1235
 */
class WAVTransform extends stream.Transform {
  protected _transform(
    data: Buffer,
    encoding: string,
    callback: (error: Error | null, data: Buffer) => void,
  ): void {
    // Convert the buffer into a `Float32Array`.
    //
    // TODO: Are there problems with this if `data.buffer.byteLength % 4 !== 0`?
    const input = new Float32Array(data.buffer);
    // Create a new array buffer which is twice as large as the `Float32Array`.
    // This would be half as large as `data.buffer.byteLength`.
    const buffer = new ArrayBuffer(input.length * 2);
    // Create a data view for our buffer.
    const view = new DataView(buffer);
    // Write the PCM samples.
    writePCMSamples(view, 0, input);
    // Send back the newly constructed buffer.
    callback(null, Buffer.from(buffer));
  }
}

/**
 * Writes PCM samples to a data view at the provided offset implementing the
 * final part of the [MediaStreamRecorder][1] reference implementation’s WAV
 * file writing.
 *
 * We will write data with a length of `input.length * 2` from the `offset` in
 * the `DataView`.
 *
 * [1]: https://github.com/streamproc/MediaStreamRecorder/blob/bef0b2082853a6a68c45e3a9e0066d6757ca75c7/MediaStreamRecorder.js#L1228-L1235
 */
function writePCMSamples(
  view: DataView,
  offset: number,
  input: Float32Array,
): void {
  // Don’t know what this does. We should find out...
  const volume = 1;
  // For every item in the array we want to add it to our newly constructed
  // array buffer.
  for (let i = 0; i < input.length; i++) {
    view.setInt16(
      offset + (i * 2),
      input[i] * (0x7FFF * volume),
      true,
    );
  }
}
