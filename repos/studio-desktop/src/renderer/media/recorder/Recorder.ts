/**
 * A state that the recorder could be in. Terminology taken directly from
 * [`MediaRecorder.state`][1].
 *
 * [1]: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/state
 */
export enum RecorderState {
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

export interface Recorder {
  readonly state: RecorderState,
  start(): void;
  stop(): Promise<Blob>;
  pause(): void;
  resume(): void;
}

export class RecorderInvalidStateError extends Error {
  constructor(recorder: Recorder) {
    super(`Invalid state '${RecorderState[recorder.state]}'`);
  }
}
