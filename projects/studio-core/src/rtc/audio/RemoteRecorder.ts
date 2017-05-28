import { EventEmitter } from '@decode/js-utils';
import { Recorder } from './Recorder';
import { RemoteRecorderProtocol } from './RemoteRecorderProtocol';

/**
 * The recorder class for the recording protocol.
 */
export
class RemoteRecorder
extends EventEmitter<Recorder.EventMap>
implements Recorder {
  /**
   * Creates a new recorder instance using the provided `RTCDataChannel`.
   */
  public static create(channel: RTCDataChannel): Promise<RemoteRecorder> {
    // Create a new promise that will resolve once we can succesfully construct
    // the recorder.
    return new Promise<RemoteRecorder>((resolve, reject) => {
      // Handles the first info message from the recordee. This is step 1 in our
      // recording protocol. Once a message is received this listener will be
      // removed. We assume that the first message is the info message. If it is
      // not then bad stuff has happened!
      const handleMessage = (event: MessageEvent) => {
        // If we were not sent a string the ignore the message.
        if (typeof event.data !== 'string') {
          return;
        }
        // Remove all of the event listeners.
        removeEventListeners();
        // Parse out the message from the event’s data.
        const message: RemoteRecorderProtocol.RecordeeInfoMessage =
          JSON.parse(event.data);
        // Resolve the promise with a new recorder instance. The `Recorder`
        // constructor is private so this is the only place it can be
        // constructed.
        resolve(new RemoteRecorder({
          channel,
          name: message.name,
          sampleRate: message.sampleRate,
        }));
      };
      // If we get an error then we need to reject the promise.
      const handleError = (event: ErrorEvent) => {
        // Remove all of the event listeners.
        removeEventListeners();
        // Reject the promise with the event’s error.
        reject(event.error);
      };
      // If the channel closes then we want to reject the promise.
      const handleClose = () => {
        // Remove all of the event listeners.
        removeEventListeners();
        // Reject the promise with a constructed error.
        reject(new Error('Channel closed.'));
      };
      // Add all of the event listeners.
      channel.addEventListener('message', handleMessage);
      channel.addEventListener('error', handleError);
      channel.addEventListener('close', handleClose);
      // Removes all of the event listeners we added.
      const removeEventListeners = () => {
        channel.removeEventListener('message', handleMessage);
        channel.removeEventListener('error', handleError);
        channel.removeEventListener('close', handleClose);
      };
    });
  }

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
   * The data channel which we will receive audio data from.
   */
  private readonly channel: RTCDataChannel;

  /**
   * The human readable name for this recorder.
   */
  public readonly name: string;

  /**
   * The audio sample rate for the audio data emit from the `stream` observable.
   */
  public readonly sampleRate: number;

  private constructor({
    channel,
    name,
    sampleRate,
  }: {
    channel: RTCDataChannel,
    name: string,
    sampleRate: number,
  }) {
    super();
    // Update our instance.
    this.channel = channel;
    this.name = name;
    this.sampleRate = sampleRate;
    // Add event listeners.
    this.channel.addEventListener('message', this.handleMessage);
    this.channel.addEventListener('error', this.handleError);
    this.channel.addEventListener('close', this.handleClose);
  }

  /**
   * Handles a message on our channel. We assume that all messages are
   * `ArrayBuffer`s.
   *
   * All of these messages constitute step 3 of the protocol.
   */
  private handleMessage = (event: MessageEvent) => {
    this.emit('data', event.data);
  };

  /**
   * Handles an error by pushing it to our stream and continuing on.
   */
  private handleError = (event: ErrorEvent) => {
    this.emit('error', event.error);
  };

  /**
   * Handles the closing of the channel by stopping our recording.
   *
   * If the channel closes this would be step 4 of the protocol when recordee
   * disconnects instead of recorder stopping the recording.
   */
  private handleClose = () => {
    if (this.stopped === false) {
      this.stop();
    }
  };

  /**
   * Tells our recordee to start recording. After this is called `stream` will
   * start to emit data from our recordee.
   *
   * If the recorder has already been stopped the recorder will throw an error.
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
    // Create the start message.
    const message: RemoteRecorderProtocol.RecorderStartMessage = 'start';
    // Send the start message across the channel. This is step 2 of the
    // protocol.
    this.channel.send(JSON.stringify(message));
  }

  /**
   * Stops the recording. After this `stream` will complete.
   *
   * If the recorder has already been stopped this will throw an error.
   */
  public stop(): void {
    // If we have already stopped the throw an error.
    if (this.stopped === true) {
      throw new Error('Cannot stop recording if we are not recording.');
    }
    // Flip our `stopped` flag to true.
    this.internalStopped = true;
    // Remove the event listeners. We will no longer need them.
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
    // Clear out all of the listeners for our event emitter.
    this.clearAllListeners();
  }
}
