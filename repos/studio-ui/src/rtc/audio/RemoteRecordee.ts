import { Subscription } from 'rxjs';
import { RemoteRecorderProtocol } from './RemoteRecorderProtocol';
import { LocalRecorder } from './LocalRecorder';

/**
 * The recordee class for the recording protocol. This class actually records
 * stuff.
 *
 * Internally we use a `LocalRecorder` instance to record the audio and then
 * send that audio data to our channel.
 */
export class RemoteRecordee implements Disposable {
  /**
   * Creates a recordee and then sends the initial info message (step 1 of the
   * protocol) across the channel when it opens. The promise resolves when the
   * channel has opened and the message has been sent.
   *
   * A human readable should be passed into this function. This name will be
   * used to identify the recordee in the host by humans.
   */
  public static async create(
    name: string,
    channel: RTCDataChannel,
  ): Promise<RemoteRecordee> {
    // Wait until the channel opens.
    await waitUntilOpen(channel);
    // Construct the info message for our channel.
    const message: RemoteRecorderProtocol.RecordeeInfoMessage = {
      name,
      sampleRate: LocalRecorder.sampleRate,
    };
    // Send the info message.
    channel.send(JSON.stringify(message));
    // Construct the recordee and return it.
    return new RemoteRecordee({
      channel,
    });
  }

  /**
   * The recorder which will record all of our stream’s data. We will subscribe
   * to this recorder’s `stream` and forward that data to our `channel`.
   */
  private readonly recorder = new LocalRecorder({
    // We don’t care about the name in a recordee.
    name: '',
    // We start the stream at null.
    stream: null,
  });

  /**
   * A state flag that switches to true when `stop()` is called.
   */
  public get stopped(): boolean {
    return this.recorder.stopped;
  }

  /**
   * The channel which we will send our recording data to.
   */
  private readonly channel: RTCDataChannel;

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
      if (this.recorder.started === true) {
        console.error(new Error('Already started.'));
        return;
      }
      // Subscribe to the recorder’s stream and send that data to our channel.
      this.subscription = this.recorder.stream.subscribe({
        // Send the data through our channel.
        next: data => this.channel.send(data),
        // If we got an error then report it.
        // TODO: Better error handling. If we get an error should the `Recorder`
        // know?
        error: error => console.error(error),
        // TODO: If we complete then we should probably record silence?
        complete: () => {},
      });
      // Start our recorder.
      this.recorder.start();
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
    if (this.recorder.stopped === false) {
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
    if (this.recorder.stopped === true) {
      throw new Error('Already stopped.');
    }
    // Unsubscribe from the stream subscription.
    if (this.subscription !== null) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    // Stop the recorder.
    this.recorder.stop();
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
  }

  /**
   * To dispose this recordee we call `stop()` if `stopped` is false.
   */
  public dispose() {
    if (this.recorder.stopped === false) {
      this.stop();
    }
  }

  /**
   * Sets the stream that should be recording. If we had another stream then
   * this will stop recording that stream and start recording this one.
   *
   * If the recording has stopped this method will throw an error.
   */
  public setStream(stream: MediaStream): void {
    this.recorder.setStream(stream);
  }

  /**
   * This will unset any stream that we are recording. Instead of any stream we
   * will be sending silence to our recorder.
   *
   * If the recording has stopped this method will throw an error.
   */
  public unsetStream(): void {
    this.recorder.unsetStream();
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
