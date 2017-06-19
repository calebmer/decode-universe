import { EventEmitter } from '~/utils/universal/EventEmitter';

export namespace Recorder {
  export interface EventMap {
    data: ArrayBuffer;
  }
}

/**
 * Any object which can captures audio and stream that audio in `ArrayBuffer`
 * chunks.
 *
 * All of the audio data is streamed with the `data` event and only starts
 * streaming after `start()` is called.
 *
 * The two main implementations of `Recorder` are `RemoteRecorder` which records
 * the audio of a peer through an `RTCDataChannel` and a `LocalRecorder` which
 * records the local computer’s audio.
 */
export interface Recorder extends EventEmitter<Recorder.EventMap> {
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
   * The audio sample rate at which the audio was recorded.
   */
  readonly sampleRate: number;

  /**
   * Starts recording audio data and sending that data in chunks to `data` event
   * listeners. No data will be emit until this method is called.
   */
  start(): void;

  /**
   * Stops audio data from being recorded. No more audio chunks will be emit to
   * `data` event listeners.
   *
   * When the recorder is stopped all listeners will be disposed.
   */
  stop(): void;
}
