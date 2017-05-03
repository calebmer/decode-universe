import { Observable } from 'rxjs';

/**
 * Any object which can captures audio and stream that audio in `ArrayBuffer`
 * chunks.
 *
 * The two main implementations of `Recorder` are `RemoteRecorder` which records
 * the audio of a peer through an `RTCDataChannel` and a `LocalRecorder` which
 * records the local computer’s audio.
 */
export interface Recorder {
  /**
   * False until `start()` is called. It will still be true after `stop()` is
   * called.
   */
  readonly started: boolean;

  /**
   * False until `stop()` is called. False even when `start()` has not been
   * called.
   */
  readonly stopped: boolean;

  /**
   * A human readable name for the recorder.
   */
  readonly name: string;

  /**
   * The audio sample rate at which the audio in `stream` was recorded.
   */
  readonly sampleRate: number;

  /**
   * An observable of `ArrayBuffer` chunks that represent the audio data as it
   * is streamed from the source.
   *
   * This is a hot observable that only starts emitting audio data after
   * `start()` has been called and completes when `stop()` is called. If you
   * subscribe to this observable at sometime after `start()` is called you may
   * lose some audio data that was recorded before you subscribed.
   */
  readonly stream: Observable<ArrayBuffer>;

  /**
   * Starts recording audio data and sending that data in chunks to `stream`. No
   * data will be emit on `stream` until this method is called.
   */
  start(): void;

  /**
   * Stops audio data from being recorded. No more audio chunks will be emit on
   * `stream`, and `stream` should complete after this method is called.
   */
  stop(): void;
}
