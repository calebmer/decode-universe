import Disposable from '~/utils/universal/Disposable';
import * as RemoteRecorderProtocol from './RemoteRecorderProtocol';
import LocalRecorder from './LocalRecorder';

/**
 * The recordee class for the recording protocol. This class actually records
 * stuff.
 *
 * Internally we use a `LocalRecorder` instance to record the audio and then
 * send that audio data to our channel.
 */
export default class RemoteRecordee implements Disposable {
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
    context: AudioContext,
  ): Promise<RemoteRecordee> {
    // Wait until the channel opens.
    await waitUntilOpen(channel);
    // Construct the info message for our channel.
    const message: RemoteRecorderProtocol.RecordeeInfoMessage = {
      name,
      sampleRate: context.sampleRate,
    };
    // Send the info message.
    channel.send(JSON.stringify(message));
    // Construct the recordee and return it.
    return new RemoteRecordee({
      channel,
      context,
    });
  }

  /**
   * The recorder which will record all of our audio data. We will subscribe
   * to this recorder’s `stream` and forward that data to our `channel`.
   */
  private readonly recorder: LocalRecorder;

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

  private constructor({
    channel,
    context,
  }: {
    channel: RTCDataChannel;
    context: AudioContext;
  }) {
    this.channel = channel;
    // Add all the event listeners.
    this.channel.addEventListener('message', this.handleMessage);
    this.channel.addEventListener('error', this.handleError);
    this.channel.addEventListener('close', this.handleClose);
    // Initialize the local recorder.
    this.recorder = new LocalRecorder({
      // We don’t care about the name in a recordee.
      name: '',
      // Use the context we were provided.
      context,
      // We start the audio at null.
      audio: null,
    });
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
      // Listen to the recorder’s stream and send that data to our channel.
      // When the recorder closes this event listener should be removed.
      this.recorder.on('data', data => {
        // Send the data through our channel.
        this.channel.send(data);
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
    // Stop the recorder. This will also remove all our event listeners.
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
   * Sets the audio that should be recording. If we had another audio then
   * this will stop recording that audio and start recording this one.
   *
   * If the recording has stopped this method will throw an error.
   */
  public setAudio(audio: AudioNode): void {
    this.recorder.setAudio(audio);
  }

  /**
   * This will unset any audio that we are recording. Instead of any audio we
   * will be sending silence to our recorder.
   *
   * If the recording has stopped this method will throw an error.
   */
  public unsetAudio(): void {
    this.recorder.unsetAudio();
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
        reject(
          new Error(
            `Channel will not open if the state is ${channel.readyState}`,
          ),
        );
        break;
      }
    }
  });
}
