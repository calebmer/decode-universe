import { Subscription } from 'rxjs';
import { RecordingProtocol } from './RecordingProtocol';
import { MediaStreamRecorder } from './MediaStreamRecorder';

/**
 * The recordee class for the recording protocol. This class actually records
 * stuff.
 */
// TODO: When we have no stream we still want to send data for silence.
export class Recordee implements Disposable {
  /**
   * Creates a recordee and then sends the initial info message (step 1 of the
   * protocol) across the channel when it opens. The promise resolves when the
   * channel has opened and the message has been sent.
   */
  public static async create(channel: RTCDataChannel): Promise<Recordee> {
    // Wait until the channel opens.
    await waitUntilOpen(channel);
    // Construct the info message for our channel.
    const message: RecordingProtocol.RecordeeInfoMessage = {
      sampleRate: MediaStreamRecorder.context.sampleRate,
    };
    // Send the info message.
    channel.send(JSON.stringify(message));
    // Construct the recordee and return it.
    return new Recordee({
      channel,
    });
  }

  /**
   * A state flag that switches to true when `start()` is called.
   */
  private started = false;

  /**
   * A state flag that switches to true when `stop()` is called.
   */
  private internalStopped = false;

  /**
   * Whether or not the recordee has stopped.
   */
  public get stopped(): boolean {
    return this.internalStopped;
  }

  /**
   * The channel which we will send our recording data to.
   */
  private readonly channel: RTCDataChannel;

  /**
   * The stream with which we are currently recording or which we should record
   * when the recording starts. `null` if we want to record silence instead of a
   * `MediaStream`.
   */
  private stream: MediaStream | null = null;

  /**
   * The subscription which represents anything that is currently recording. If
   * nothing is currently recording then it will be null.
   */
  private subscription: Subscription | null = null;

  private constructor({
    channel,
  }: {
    channel: RTCDataChannel,
  }) {
    this.channel = channel;
    // Add all the event listeners.
    this.channel.addEventListener('message', this.handleMessage);
    this.channel.addEventListener('error', this.handleError);
    this.channel.addEventListener('close', this.handleClose);
  }

  /**
   * Handle a message from the data channel. This could start recording.
   */
  private handleMessage = (event: MessageEvent) => {
    // If we get a start message then we want to start recording and sending
    // over the data.
    if (JSON.parse(event.data) === 'start') {
      // If we have already started report an error and don’t continue.
      if (this.started === true) {
        console.error(new Error('Already started.'));
        return;
      }
      // Flip our started flag to true.
      this.started = true;
      // Start recording either silence or the stream and send that data over
      // the channel. This makes up step 3 of the protocol.
      if (this.stream === null) {
        this.recordSilence();
      } else {
        this.recordStream(this.stream);
      }
    }
  };

  /**
   * If we got an error then we want to report it.
   */
  private handleError = (event: ErrorEvent) => {
    console.error(event.error);
  };

  /**
   * If the channel closed then we stopped, so call `stop()` if we haven’t
   * already.
   */
  private handleClose = () => {
    if (this.stopped === false) {
      this.stop();
    }
  };

  /**
   * Stops the recording by removing all our event listeners and closing the
   * channel.
   *
   * This will throw an error if the recording has already been stopped.
   */
  public stop(): void {
    // Enforce the correct state.
    if (this.stopped === true) {
      throw new Error('Already stopped.');
    }
    // Switch the stopped toggle.
    this.internalStopped = true;
    // Remove all the event listeners.
    this.channel.removeEventListener('message', this.handleMessage);
    this.channel.removeEventListener('error', this.handleError);
    this.channel.removeEventListener('close', this.handleClose);
    // If the channel is open or connecting then we want to close it. We are
    // done with it so we should free up some system resources!
    if (
      this.channel.readyState === 'connecting' ||
      this.channel.readyState === 'open'
    ) {
      this.channel.close();
    }
    // Set the stream to null since we no longer will need it.
    this.stream = null;
    // Unsubscribe the subscription if we still have one.
    if (this.subscription !== null) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }

  /**
   * This will stop the recording if the recording has not already been stopped.
   */
  public dispose(): void {
    if (this.stopped === false) {
      this.stop();
    }
  }

  /**
   * Sets the stream that should be recording. If we had another stream then
   * this will stop recording that stream and start recording this one.
   *
   * If `null` was provided then we will seamlessly call `unsetStream()`.
   *
   * If the recording has stopped this method will throw an error.
   */
  public setStream(stream: MediaStream | null): void {
    // If the stream is null then we actually want to call `unsetStream()`.
    if (stream === null) {
      return this.unsetStream();
    }
    // Enforce the correct state.
    if (this.stopped === true) {
      throw new Error('Recording has stopped.');
    }
    // If the stream did not change then do nothing.
    if (this.stream === stream) {
      return;
    }
    // Set the stream on our instance.
    this.stream = stream;
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
    this.stream = null;
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
      next: data => this.channel.send(data.buffer),
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

/**
 * Returns a promise that resolves when the `RTCDataChannel` opens or rejects if
 * it closes before then.
 */
function waitUntilOpen(channel: RTCDataChannel): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    switch (channel.readyState) {
      case 'connecting': {
        // Resolve when the channel opens.
        const handleOpen = () => {
          removeEventListeners();
          resolve();
        };
        // Reject if there was an error.
        const handleError = (event: ErrorEvent) => {
          removeEventListeners();
          reject(event.error);
        };
        // Reject if the channel closed.
        const handleClose = () => {
          removeEventListeners();
          reject(new Error('Channel closed.'));
        };
        // Adds all our event listeners.
        channel.addEventListener('open', handleOpen);
        channel.addEventListener('error', handleError);
        channel.addEventListener('close', handleClose);
        // Function to remove all of the event listeners we added.
        const removeEventListeners = () => {
          channel.removeEventListener('open', handleOpen);
          channel.removeEventListener('error', handleError);
          channel.removeEventListener('close', handleClose);
        };
        break;
      }
      // If the state is open then we can immeadiately resolve.
      case 'open': {
        resolve();
        break;
      }
      // If the channel is any other state then it is not opening.
      default: {
        reject(new Error(
          `Channel will not open if the state is ${channel.readyState}`
        ));
        break;
      }
    }
  });
}
