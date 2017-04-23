import * as fs from 'fs';
import { Transform } from 'stream';
import { Observable } from 'rxjs';
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

async function exportRecorderToWAV(
  recorder: RecordingManifest.Recorder,
  rawFilePath: string,
  wavFilePath: string,
): Promise<void> {
  const stats = await new Promise<fs.Stats>((resolve, reject) => {
    fs.stat(
      rawFilePath,
      (error, stats) => error ? reject(error) : resolve(stats),
    );
  });
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
  // [1]: https://github.com/streamproc/MediaStreamRecorder/blob/bef0b2082853a6a68c45e3a9e0066d6757ca75c7/MediaStreamRecorder.js#L1203-L1226
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
  const readable = fs.createReadStream(rawFilePath);

  readable
    .pipe(new WAVTransform())
    .pipe(writable)
    .on('finish', () => {
      console.log('done!');
    })
    .on('error', (error: Error) => {
      console.error(error);
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

class WAVTransform extends Transform {
  _transform(
    data: Buffer,
    encoding: string,
    callback: (error: Error | null, data: Buffer) => void,
  ): void {
    let volume = 1;
    const array = new Float32Array(data.buffer);
    const buffer = new ArrayBuffer(array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < array.length * 2; i += 2) {
      view.setInt16(i, array[i] * (0x7FFF * volume), true);
    }
    callback(null, Buffer.from(buffer));
  }
}
