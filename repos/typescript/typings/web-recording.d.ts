/**
 * Types for the [MediaStream Recording API][1].
 *
 * [1]: https://developer.mozilla.org/en-US/docs/Web/API/MediaStream_Recording_API
 */

interface MediaRecorderEventMap {
  'dataavailable': Event & { data: Blob };
  'error': Event;
  'pause': Event;
  'resume': Event;
  'start': Event;
  'stop': Event;
}

/**
 * https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
 */
declare class MediaRecorder extends EventTarget {
  constructor(
    stream: MediaStream,
    options?: {
      mimeType?: string,
      audioBitsPerSecond?: number,
      videoBitsPerSecond?: number,
      bitsPerSecond?: number,
    },
  );

  readonly mimeType: string;
  readonly state: 'inactive' | 'recording' | 'paused';
  readonly stream: MediaStream;
  ignoreMutedMedia: boolean;
  readonly videoBitsPerSecond: number;
  readonly audioBitsPerSecond: number;

  static isTypeSupported(mimeType: string): boolean;
  pause(): void;
  requestData(): void;
  resume(): void;
  start(): void;
  stop(): void;

  ondataavailable: (this: MediaRecorder, ev: Event & { data: Blob }) => any;
  onerror: (this: MediaRecorder, ev: Event) => any;
  onpause: (this: MediaRecorder, ev: Event) => any;
  onresume: (this: MediaRecorder, ev: Event) => any;
  onstart: (this: MediaRecorder, ev: Event) => any;
  onstop: (this: MediaRecorder, ev: Event) => any;

  addEventListener<K extends keyof MediaRecorderEventMap>(type: K, listener: (this: MediaRecorder, ev: MediaRecorderEventMap[K]) => any, useCapture?: boolean): void;
}
