import { Subject } from 'rxjs';
import { Recorder } from './Recorder';
import { AudioNodeRecorder } from './AudioNodeRecorder';

/**
 * A `Recorder` that when `start()` is called records all of the audio from the
 * local audio managed by `setAudio()` and `unsetAudio()`. There are no fancy
 * network shenanigans with this class.
 */
export class LocalRecorder implements Recorder {
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
   * The human readable name used to identify this recording.
   */
  public readonly name: string;

  /**
   * The audio context we use to record all of our audio nodes.
   */
  private readonly context: AudioContext;

  /**
   * The audio sample rate for the audio data emit from the `stream` observable.
   */
  public get sampleRate(): number {
    return this.context.sampleRate;
  }

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
   * The audio with which we are currently recording or which we should record
   * when the recording starts. `null` if we want to record silence instead of
   * an `AudioNode`.
   */
  private audio: AudioNode | null;

  /**
   * The disposable which will dispose the process currently recording audio. If
   * nothing is currently recording then it will be null.
   */
  private disposable: Disposable | null = null;

  constructor({
    name,
    context,
    audio,
  }: {
    name: string,
    context: AudioContext,
    audio: AudioNode | null,
  }) {
    this.name = name;
    this.context = context;
    this.audio = audio;
  }

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
    // Start recording either silence or audio and stream that data.
    if (this.audio === null) {
      this.recordSilence();
    } else {
      this.recordAudio(this.audio);
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
    // Set the audio to null since we no longer will need it.
    this.audio = null;
    // Dispose the disposable if we still have one.
    if (this.disposable !== null) {
      this.disposable.dispose();
      this.disposable = null;
    }
  }

  /**
   * Sets the audio that should be recording. If we had another audio node then
   * this will stop recording that audio node and start recording this one.
   *
   * If the recording has stopped this method will throw an error.
   */
  public setAudio(audio: AudioNode): void {
    // Enforce the correct state.
    if (this.stopped === true) {
      throw new Error('Recording has stopped.');
    }
    // If the audio did not change then do nothing.
    if (this.audio === audio) {
      return;
    }
    // Set the audio on our instance.
    this.audio = audio;
    // If we have started recording then record the audio. This will
    // will unsubscribe any of the last recordings.
    if (this.started === true) {
      this.recordAudio(audio);
    }
  }

  /**
   * This will unset any audio that we are recording. Instead of any audio we
   * will be sending silence to our recorder.
   *
   * If the recording has stopped this method will throw an error.
   */
  public unsetAudio(): void {
    // Enforce the correct state.
    if (this.stopped === true) {
      throw new Error('Recording has stopped.');
    }
    // If we have already unset the audio then do nothing.
    if (this.audio === null) {
      return;
    }
    // Set the audio to null.
    this.audio = null;
    // If we have started recording then we want to record silence while there
    // is no audio. This will unsubscribe any of the last recordings.
    if (this.started === true) {
      this.recordSilence();
    }
  }

  /**
   * Starts recording an `AudioNode`. If something was already recording then
   * it will be stopped.
   */
  private recordAudio(audio: AudioNode): void {
    // If there is currently a disposable then we want to dispose it.
    if (this.disposable !== null) {
      this.disposable.dispose();
    }
    // Start recording the audio and get a subscription that we can unsubscribe
    // from at a later time.
    const subscription =
      AudioNodeRecorder.record(this.context, audio).subscribe({
        // Send the data through our channel.
        next: data => this.streamSubject.next(data.buffer),
      });
    // Add a disposable which will unsubscribe from our subscription.
    this.disposable = {
      // TODO: Wait for the next emission and then cut it so that we emit the
      // *exact* amount of data instead of losing a chunk.
      dispose: () => subscription.unsubscribe(),
    };
  }

  /**
   * Starts recording silence. If something was already recording then it will
   * be stopped.
   */
  private recordSilence(): void {
    // If there is currently a disposable then we want to dispose it.
    if (this.disposable !== null) {
      this.disposable.dispose();
    }
    // Start recording silence and get a subscription that we can unsubscribe
    // from at a later time.
    const subscription =
      AudioNodeRecorder.recordSilence(this.context).subscribe({
        // Send the data through our channel.
        next: data => this.streamSubject.next(data.buffer),
      });
    // Add a disposable which will unsubscribe from our subscription.
    this.disposable = {
      // TODO: Wait for the next emission and then cut it so that we emit the
      // *exact* amount of data instead of losing a chunk.
      dispose: () => subscription.unsubscribe(),
    };
  }
}
