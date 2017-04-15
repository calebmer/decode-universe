import { writeFile } from 'fs';
import { BehaviorSubject } from 'rxjs';

/**
 * A state that the recorder could be in. Terminology taken directly from
 * [`MediaRecorder.state`][1].
 *
 * [1]: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/state
 */
export enum RecordingState {
  /**
   * Recording is not occuring — it has either not been started yet, or it has
   * been started and then stopped.
   */
  inactive,

  /**
   * Recording has been started and the UA is capturing data.
   */
  recording,

  /**
   * Recording has been started, then paused, but not yet stopped or resumed.
   */
  paused,
}

export class MediaStreamsRecorder {
  private readonly stateSubject = new BehaviorSubject(RecordingState.inactive);

  public readonly state = this.stateSubject.asObservable();

  private readonly recorders = new Map<MediaStream, MediaRecorder>();

  public addStream(stream: MediaStream): void {
    // If we already have a recorder for this stream then noop.
    if (this.recorders.has(stream)) {
      return;
    }
    // Create a recorder for the stream.
    this.recorders.set(stream, this.createRecorder(stream));
  }

  public removeStream(stream: MediaStream): void {
    // If we do not have a recorder for this stream then noop.
    if (!this.recorders.has(stream)) {
      return;
    }
    // Get the recorder.
    const recorder = this.recorders.get(stream)!;
    // If the recording state is not inactive then stop the recorder.
    if (this.stateSubject.value !== RecordingState.inactive) {
      recorder.stop();
    }
    // Delete the recorder from our map.
    this.recorders.delete(stream);
  }

  private createRecorder(stream: MediaStream): MediaRecorder {
    const recorder = new MediaRecorder(stream, {
      // As of the time of this code being written, Chrome only supports
      // `audio/webm`. If it ever supports WAV or MP3 formats in the future we
      // may want to use those.
      mimeType: 'audio/webm',
      // We would like to set our audio bits-per-second to 256 kbit/s because
      // according to Wikipedia it is a [commonly used high-quality bitrate for
      // MP3][1]. However, Chrome clamps the bitrate to 128 kbit/s so we can’t
      // use 256 kbit/s.
      //
      // [1]: https://en.wikipedia.org/wiki/Bit_rate#MP3
      //
      // TODO: Consult with a professional to see if this is actually the best
      // bitrate for our product. This bitrate is also for WebM and not MP3 so
      // there may be a difference?
      audioBitsPerSecond: 128000,
    });
    recorder.addEventListener('dataavailable', ({ data }) => {
      blobToBuffer(data)
        .then(buffer => new Promise((resolve, reject) => {
          writeFile(`/Users/calebmer/Desktop/test-${Math.round(Math.random() * 1000)}.webm`, buffer, error => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        }))
        .catch(console.error)
    });
    // Change the recorder’s state based on our current state.
    switch (this.stateSubject.value) {
      // If we are recording then start the recorder.
      case RecordingState.recording: {
        recorder.start();
        break;
      }
      // If we are paused then start the recorder, but then pause the recorder.
      case RecordingState.paused: {
        recorder.start();
        recorder.pause();
        break;
      }
      // If the state is inactive then this is a noop!
      case RecordingState.inactive: {
        break;
      }
    }
    return recorder;
  }

  public start(): void {
    // Start or resume all of our recorders. If we are currently in a paused
    // state then we need to resume our recordings instead of starting a
    // new one.
    for (const recorder of this.recorders.values()) {
      if (this.stateSubject.value === RecordingState.paused) {
        recorder.resume();
      } else {
        recorder.start();
      }
    }
    // Set our state to recording.
    this.stateSubject.next(RecordingState.recording);
  }

  public pause(): void {
    // Pause all of our recorders.
    for (const recorder of this.recorders.values()) {
      recorder.pause();
    }
    // Set our state to paused.
    this.stateSubject.next(RecordingState.paused);
  }

  public stop(): void {
    // Stop all of our recorders.
    for (const recorder of this.recorders.values()) {
      recorder.stop();
    }
    // Set our state to paused.
    this.stateSubject.next(RecordingState.inactive);
  }
}

function blobToBuffer(blob: Blob): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    // Construct a `FileReader`.
    const reader = new FileReader();
    // Add our `load` callback which will remove itself once `load` finishes.
    reader.addEventListener('load', onLoad);
    // Start the reading of the blob.
    reader.readAsArrayBuffer(blob);

    function onLoad() {
      // Remove the event listener. This function should only run once.
      reader.removeEventListener('load', onLoad);
      // If an error occurred while reading then we want to reject the promise.
      // Otherwise we want to convert the `ArrayBuffer` result we got into a
      // JavaScript `Buffer` object.
      if (reader.error) {
        reject(reader.error);
      } else {
        resolve(Buffer.from(reader.result));
      }
    }
  });
}
