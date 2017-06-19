import * as path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import * as stream from 'stream';
import * as moment from 'moment';
import { Stream } from 'xstream';
import { slugify } from '@decode/js-utils';
import { RecordingStorage } from './RecordingStorage';
import { RecorderStorage } from './RecorderStorage';

/**
 * Export all of a recording’s assets to the provided directory.
 *
 * Returns a stream that emits the export progress with numbers in the
 * range of 0 to 1. Unsubscribing from the stream does not cancel the
 * export!
 */
// This needs to be called `doExport` because `export` is a syntax error.
async function doExport(
  recording: RecordingStorage,
  exportDirectoryPath: string,
): Promise<Stream<number>> {
  // Get the file names for all our recorders.
  const recorderFileNames = getRecorderFileNames(recording);
  // Wait for all of the recorders to export.
  const byteProgresses = await Promise.all(
    Array.from(recording.getAllRecorders()).map(async ([id, recorder]) => {
      // If we did not get a name for this recorder then we need to throw an
      // error.
      if (!recorderFileNames.has(id)) {
        throw new Error(`Did not get a file name for recorder with id '${id}'`);
      }
      // Get the file name for this recorder’s id. We know it exists.
      const fileName = recorderFileNames.get(id)!;
      // Export the recorder to WAV at the specified output file path.
      return await exportRecorderToWAV(
        recorder,
        path.join(exportDirectoryPath, fileName),
      );
    }),
  );
  // Sum up all of our byte sizes to get the total byte size.
  const totalByteSize = byteProgresses
    .map(({ byteSize }) => byteSize)
    .reduce((a, b) => a + b, 0);
  // Merge all of the streams so that whenever we get some new bytes they
  // all show up on the stream.
  return (
    Stream.merge(...byteProgresses.map(({ bytes }) => bytes))
      // Folds the stream by summing up all of the bytes as they come in.
      .fold((currentBytes, bytes) => currentBytes + bytes, 0)
      // Divide our current bytes count with the total byte size to get the
      // progress from 0 to 1.
      .map(currentBytes => currentBytes / totalByteSize)
  );
}

/**
 * Get all of the file names that we expect from an export so that we can check
 * for collisions in the file system before we export.
 */
function getExportFileNames(recording: RecordingStorage): Set<string> {
  // Get the recorder file names and return a set of just the values.
  return new Set(getRecorderFileNames(recording).values());
}

/**
 * Gets a map of recorder ids to the file name we will use for that recorder. We
 * need to do this in a batch so that we can handle duplicate shortened names.
 */
// TODO: test!!!!!!
function getRecorderFileNames(
  recording: RecordingStorage,
): Map<string, string> {
  // The extension we will add to our file names.
  const extension = '.wav';
  // While we want to return a map of `id`s to `fileName`s this map is the
  // reverse. It shows `fileName`s to an array of `id`s. This allows us to
  // dedupe file names that are generated for a few different recorder ids.
  const reverseFileNames = new Map<string, Array<string>>();
  // For all of the recorders...
  for (const [id, { name }] of recording.getAllRecorders()) {
    // Get the file name for this recorder.
    const fileName = getFileName(recording.startedAt, name);
    // If we already have this file name then add the id to the array of ids
    // corresponding to this file name.
    //
    // Otherwise we want to create a new array where this id is the only one.
    if (reverseFileNames.has(fileName)) {
      reverseFileNames.get(fileName)!.push(id);
    } else {
      reverseFileNames.set(fileName, [id]);
    }
  }
  // Now create our actual file name map.
  const fileNames = new Map<string, string>();
  // For all of the reverse file names...
  for (const [fileName, ids] of reverseFileNames) {
    // If there is only one id for this file name then we do not need to dedupe
    // the name. Otherwise we will need to add a number to the end in order to
    // dedupe the extension.
    if (ids.length === 1) {
      // Set the id with the filename plus the extension.
      fileNames.set(ids[0], fileName + extension);
    } else {
      let index = 1;
      // Set a file name for all of the ids, all the while adding an index to
      // the end of the file name to dedupe it.
      for (const id of ids) {
        fileNames.set(id, `${fileName}-${index++}` + extension);
      }
    }
  }
  // Return the finalized file names map.
  return fileNames;
}

/**
 * Gets the file name (without extension) for a recorder by turning the
 * `startedAt` time into a concise time stamp and slugifying the `name`.
 */
function getFileName(startedAt: number, name: string): string {
  // Format the time into a simple timestamp format that contains the date and
  // the time.
  const time = moment(startedAt).format('YYYY-MM-DD');
  // Turn the name into a slug. The process involves lowercasing the string,
  // replacing all series of non alpha-numeric characters with a hyphen (`-`),
  // and finally remove leading and trailing hyphones.
  const slug = slugify(name);
  // If the slug is not an empty string then let us add it onto the time.
  return time + (slug !== '' ? `-${slug}` : '');
}

export const RecordingExporter = {
  export: doExport,
  getExportFileNames,
};

/**
 * Exports a recorder’s raw data to a WAV file ready for editing in any audio
 * editor app.
 *
 * The `rawFilePath` should point to the file which the recorder’s `stream` was
 * saved without changes.
 */
async function exportRecorderToWAV(
  recording: RecorderStorage,
  outputFilePath: string,
): Promise<
  {
    byteSize: number;
    bytes: Stream<number>;
  }
> {
  // Get the byte size of our raw file. We will use this to write our header.
  const byteSize = await recording.getByteLength();
  // Compute the number of silence samples we will need to add to the start of
  // the output WAV recording. This is computed from the `startedAtDelta` time
  // on our recorder. If it is not 0 then the recorder started a little bit
  // after the recording and we should add silence to pad the output so that all
  // our recordings have a consistent length.
  const silenceSampleSize = Math.floor(
    recording.sampleRate * (recording.startedAtDelta / 1000),
  );
  // The final sample size of our recording. It will be the size of our raw file
  // divided by 4.
  const sampleSize = byteSize / 4 + silenceSampleSize;
  // Create a write stream which we will use to write out the WAV data as we get
  // it.
  const writable = createWriteStream(outputFilePath);
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
    view.setUint32(24, recording.sampleRate, true);
    // Byte rate (sample rate * block align).
    view.setUint32(28, recording.sampleRate * 1 * 2, true); // numChannels * 2 (via https://github.com/streamproc/MediaStreamRecorder/pull/71)
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
  // Create a stream to push all of the byte counts from our reporter to.
  const bytes = Stream.create<number>();
  // Create a new reporter which will report the bytes passing through to our
  // subject.
  const reporter = new ByteReporter(bytes);
  // Create a stream that will read our raw file.
  createReadStream(recording.rawFilePath)
    // Pipe the stream into a transformer which will immeadiately pass through
    // the data while also reporting the length of the bytes processed.
    //
    // This needs to be before the `WAVTransform` to be based off of the data
    // that is most closely associated to the total `byteSize`.
    .pipe(reporter)
    // Pipe the readable stream into a `WAVTransform` which will convert the
    // raw data into data appropriate for WAV files.
    .pipe(new WAVTransform())
    // Write the result of the transformed data to our writable.
    .pipe(writable)
    // When we finish or get an error then complete or error out our bytes
    // subject.
    .on('finish', () => bytes.shamefullySendComplete())
    .on('error', (error: Error) => bytes.shamefullySendError(error));
  // Return our full byte size and the bytes stream.
  return {
    byteSize,
    bytes,
  };
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
  _transform(
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
 * A transformer that passes through all the data, but also reports how many
 * bytes have passed through periodically.
 *
 * We don’t send all the bytes whenever we get them because that has some
 * serious performance penalties. By buffering and flushing byte counts
 * periodically performance is greatly improved!
 */
class ByteReporter extends stream.Transform {
  /**
   * We will output our bytes here when we have enough that we feel like an emit
   * is a good idea.
   */
  private readonly bytes: Stream<number>;

  /**
   * The buffered byte count which we will periodically flush to `bytesSubject`.
   */
  private bufferedByteCount = 0;

  constructor(bytes: Stream<number>) {
    super();
    this.bytes = bytes;
    // Schedule a byte flush for 100ms from now.
    this.scheduleFlushBytes();
  }

  _transform(
    data: Buffer,
    encoding: string,
    callback: (error: Error | null, data: Buffer) => void,
  ): void {
    // Add the byte count from this data to our buffered byte count.
    this.bufferedByteCount += data.length;
    // Send the data right back!
    callback(null, data);
  }

  _flush(callback: () => void) {
    // If there was already a timeout then we need to clear it.
    if (this.flushBytesTimeout !== null) {
      clearTimeout(this.flushBytesTimeout);
    }
    // Flush any remaining bytes we may have.
    this.flushBytes();
    // Call our callback.
    callback();
  }

  /**
   * The timeout we use for tracking byte flushes.
   */
  private flushBytesTimeout: any = null;

  /**
   * Schedule a call to `flushBytes()`.
   */
  private scheduleFlushBytes(): void {
    // If there was already a timeout then we need to clear it.
    if (this.flushBytesTimeout !== null) {
      clearTimeout(this.flushBytesTimeout);
    }
    // Set the timeout to flush some bytes.
    this.flushBytesTimeout = setTimeout(() => {
      // Remove the timeout now that it has been called.
      this.flushBytesTimeout = null;
      // Flush the bytes.
      this.flushBytes();
      // Schedule another byte flush.
      this.scheduleFlushBytes();
    }, 125);
  }

  /**
   * Flush any buffered bytes we have to our subject.
   */
  private flushBytes(): void {
    // Flush our bytes to the subject.
    this.bytes.shamefullySendNext(this.bufferedByteCount);
    // Reset the byte count back to 0.
    this.bufferedByteCount = 0;
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
    view.setInt16(offset + i * 2, input[i] * (0x7fff * volume), true);
  }
}
