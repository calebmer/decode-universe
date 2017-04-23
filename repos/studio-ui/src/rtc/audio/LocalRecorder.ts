import { Subject, Subscription } from 'rxjs';
import { Recorder } from './Recorder';
import { MediaStreamRecorder } from './MediaStreamRecorder';

/**
 * A `Recorder` that when `start()` is called records all of the audio from the
 * local stream managed by `setStream()` and `unsetStream()`. There are no fancy
 * network shenanigans with this class.
 */
export class LocalRecorder implements Recorder {
  /**
   * The `sampleRate` with which the recorder will use to record audio.
   */
  public static sampleRate = MediaStreamRecorder.context.sampleRate;

  private internalStarted = false;
  private internalStopped = false;

  /**
   * A state flag that switches to true when `start()` is called.
   */
  public get started(): boolean {
    return this.internalStarted;
  }

  /**
   * A state flag that switches to true when `stop()` is called.
   */
  public get stopped(): boolean {
    return this.internalStopped;
  }

  /**
   * The audio sample rate for the audio data emit from the `stream` observable.
   */
  public readonly sampleRate = MediaStreamRecorder.context.sampleRate;

  /**
   * The internal subject for `stream` which we can use to emit events. We want
   * to expose an `Observable` and not the powerful `Subject` methods so this is
   * private whereas `stream` is just an observable version of this.
   */
  private readonly streamSubject = new Subject<ArrayBuffer>();

  /**
   * A hot observable that emits all of the recording data as we receive it from
   * our data channel. If you don’t subscribe before calling `start()` then you
   * may miss some data!
   */
  public readonly stream = this.streamSubject.asObservable();

  /**
   * The stream with which we are currently recording or which we should record
   * when the recording starts. `null` if we want to record silence instead of a
   * `MediaStream`.
   */
  private mediaStream: MediaStream | null = null;

  /**
   * The subscription which represents anything that is currently recording. If
   * nothing is currently recording then it will be null.
   */
  private subscription: Subscription | null = null;

  /**
   * Starts recording our local audio and sending that audio to `stream`.
   */
  public start(): void {
    // State check.
    if (this.stopped === true) {
      throw new Error('Cannot start recording when we have already stopped.');
    }
    // If we have already started then throw an error.
    if (this.started === true) {
      throw new Error('Cannot start recording if we are recording.');
    }
    // Flip our `started` flag to true.
    this.internalStarted = true;
    // Start recording either silence or the stream and stream that data.
    if (this.mediaStream === null) {
      this.recordSilence();
    } else {
      this.recordStream(this.mediaStream);
    }
  }

  /**
   * Stops our recording. The now finished `stream` will emit a `complete`
   * event.
   *
   * If the recorder has already been stopped this will throw an error.
   */
  public stop(): void {
    // Enforce the correct state.
    if (this.stopped === true) {
      throw new Error('Already stopped.');
    }
    // Switch the stopped toggle.
    this.internalStopped = true;
    // Set the stream to null since we no longer will need it.
    this.mediaStream = null;
    // Unsubscribe the subscription if we still have one.
    if (this.subscription !== null) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }

  /**
   * Sets the stream that should be recording. If we had another stream then
   * this will stop recording that stream and start recording this one.
   *
   * If the recording has stopped this method will throw an error.
   */
  public setStream(stream: MediaStream): void {
    // Enforce the correct state.
    if (this.stopped === true) {
      throw new Error('Recording has stopped.');
    }
    // If the stream did not change then do nothing.
    if (this.mediaStream === stream) {
      return;
    }
    // Set the stream on our instance.
    this.mediaStream = stream;
    // If we have started recording then the record stream. This will
    // will unsubscribe any of the last recordings.
    if (this.started === true) {
      this.recordStream(stream);
    }
  }

  /**
   * This will unset any stream that we are recording. Instead of any stream we
   * will be sending silence to our recorder.
   *
   * If the recording has stopped this method will throw an error.
   */
  public unsetStream(): void {
    // Enforce the correct state.
    if (this.stopped === true) {
      throw new Error('Recording has stopped.');
    }
    // If we have already unset the stream then do nothing.
    if (this.stream === null) {
      return;
    }
    // Set the stream to null.
    this.mediaStream = null;
    // If we have started recording then we want to record silence while there
    // is no stream. This will unsubscribe any of the last recordings.
    if (this.started === true) {
      this.recordSilence();
    }
  }

  /**
   * Starts recording a `MediaStream`. If something was already recording then
   * it will be stopped.
   */
  private recordStream(stream: MediaStream): void {
    // If there is currently a subscription then we want to unsubscribe from it.
    if (this.subscription !== null) {
      this.subscription.unsubscribe();
    }
    // Start recording the stream and get a subscription that we can unsubscribe
    // from at a later time.
    this.subscription = MediaStreamRecorder.record(stream).subscribe({
      // Send the data through our channel.
      next: data => this.streamSubject.next(data.buffer),
      // If we got an error then report it.
      // TODO: Better error handling. If we get an error should the `Recorder`
      // know?
      error: error => console.error(error),
      // TODO: If we complete then we should probably record silence?
      complete: () => {},
    });
  }

  /**
   * Starts recording silence. If something was already recording then it will
   * be stopped.
   */
  private recordSilence(): void {
    // If there is currently a subscription then we want to unsubscribe from it.
    if (this.subscription !== null) {
      this.subscription.unsubscribe();
    }
    // TODO: Actually record silence instead of providing a noop subscription!
    this.subscription = { unsubscribe: () => {} };
  }
}
