import { EventEmitter } from '@decode/js-utils';
import { Recorder } from './Recorder';

/**
 * The buffer size we use when creating script processors. We use the highest
 * value which means we will be sending the minimum number of messages over the
 * network at all times.
 */
const bufferSize = 16384;

/**
 * A `Recorder` that when `start()` is called records all of the audio from the
 * local audio managed by `setAudio()` and `unsetAudio()`. There are no fancy
 * network shenanigans with this class.
 */
export class LocalRecorder extends EventEmitter<Recorder.EventMap>
  implements Recorder {
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
   * The processor for our audio node which will report our audio data. We
   * connect any audio we may have to this node and then the audio will be
   * reported.
   *
   * `null` if the recording has not yet started.
   */
  private processor: ScriptProcessorNode | null = null;

  /**
   * The audio with which we are currently recording or which we should record
   * when the recording starts. `null` if we want to record silence instead of
   * an `AudioNode`.
   */
  private audio: AudioNode | null;

  constructor({
    name,
    context,
    audio,
  }: {
    name: string;
    context: AudioContext;
    audio: AudioNode | null;
  }) {
    super();
    this.name = name;
    this.context = context;
    this.audio = audio;
  }

  /**
   * Handles any data we get for processing. We basically just forward that
   * data to our observable.
   */
  private readonly handleAudioProcess = (event: AudioProcessingEvent) => {
    const { inputBuffer } = event;
    // Clone the channel data and send the input channel data to our channel
    // data observers.
    const data = new Float32Array(inputBuffer.getChannelData(0));
    this.emit('data', data.buffer);
  };

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
    // Create a script processor. We record in mono which is why we have one
    // input and output channel. We also use the largest buffer size. This means
    // we will be sending the minimum number of messages over the network.
    this.processor = this.context.createScriptProcessor(bufferSize, 1, 1);
    // If we have some audio then we will want to connect that audio to our
    // audio processor.
    if (this.audio !== null) {
      this.audio.connect(this.processor);
    }
    // Connect the processor to our context’s destination. Since the processor
    // does not actually process the audio data (it just reports it) nothing
    // will be played to the context’s destination.
    this.processor.connect(this.context.destination);
    // Add the processor event listener.
    this.processor.addEventListener('audioprocess', this.handleAudioProcess);
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
    // If we had no processor.
    if (this.processor === null) {
      // Set the audio to null since we no longer will need it.
      this.audio = null;
      // End early.
      return;
    }
    // If we had some audio previously then we need to disconnect it.
    if (this.audio !== null) {
      this.audio.disconnect(this.processor);
    }
    // Set the audio to null since we no longer will need it.
    this.audio = null;
    // Remove our event listener.
    this.processor.removeEventListener('audioprocess', this.handleAudioProcess);
    // Disconnect our processor from the destination.
    this.processor.disconnect(this.context.destination);
    // Clear out all of the listeners for our event emitter.
    this.clearAllListeners();
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
    // If we had some audio previously then we need to disconnect it.
    if (this.processor !== null && this.audio !== null) {
      this.audio.disconnect(this.processor);
    }
    // Set the audio on our instance.
    this.audio = audio;
    // Connect our new audio.
    if (this.processor !== null) {
      this.audio.connect(this.processor);
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
    // If we had some audio previously then we need to disconnect it.
    if (this.processor !== null && this.audio !== null) {
      this.audio.disconnect(this.processor);
    }
    // Set the audio to null.
    this.audio = null;
  }
}
