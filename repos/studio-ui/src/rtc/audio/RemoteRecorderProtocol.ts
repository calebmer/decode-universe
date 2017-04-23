/**
 * The types that are used in the Decode Studio Recording Protocol.
 *
 * The following is a visualization of the lifecycles which make up the Decode
 * Studio Recording Protocol. The protocol is designed in such a way where a
 * guest may asynchronously send its local recording to the host while the
 * recording is happening. This allows us to avoid the “leave your browser while
 * your audio uploads” phase which is embarassing for hosts and inconvenient for
 * guests.
 *
 * The following are visualizations of the different lifecycles between
 * recorders and recordees. In the first usage of this protocol the host will be
 * the recorder for each guest, and each guest will be a recordee. In the future
 * we may make this a little more complicated so that a guest may be a recorder
 * and forward both its recording and its recordee’s recording to the host to
 * balance out network load.
 *
 * While we use the names “recorder” and “recordee” which make semantic sense
 * when looking at the network from a top-down view, the “recordee” will
 * actually be the one recording its own audio. The “recordee” then sends that
 * audio to the “recorder” who initiated the interaction.
 *
 * This lifecycle only happens after two peers have sucesfully established a
 * connection.
 *
 * 1. `(recorder) <----------- (recordee)`:
 *    The recordee gives the recorder information about the recording data it
 *    will to send. At this point the recorder should generate a unique id for
 *    the recording session. This should be sent immeadiately after a connection
 *    has been established.
 * 2. `(recorder) -----------> (recordee)`:
 *    The recorder tells the recordee to start recording. The recorder will also
 *    keep track of the time at which it started the recording. This may happen
 *    at any time after step 1.
 * 3. `(recorder) <=========== (recordee)`:
 *    From then on out the recordee will stream all of its recording data to the
 *    recorder. The recorder will assume that it is receiving all the data
 *    without interruption.
 * 4. `(recorder) -----------> (recordee)`:
 *    The recorder tells the recordee to stop recording data. The recorder will
 *    no longer listen to messages from the recordee sending recording data and
 *    the recordee should send no more messages.
 *
 * However, the recordee may disconnect and the lifecycle looks a little
 * different.
 *
 * 1. `(recorder) <----------- (recordee)`:
 *    The recordee gives the recorder information about the recording data it
 *    will to send. At this point the recorder should generate a unique id for
 *    the recording session. This should be sent immeadiately after a connection
 *    has been established.
 * 2. `(recorder) -----------> (recordee)`:
 *    The recorder tells the recordee to start recording. The recorder will also
 *    keep track of the time at which it started the recording. This may happen
 *    at any time after step 1.
 * 3. `(recorder) <=========== (recordee)`:
 *    From then on out the recordee will stream all of its recording data to the
 *    recorder. The recorder will assume that it is receiving all the data
 *    without interruption.
 * 4. `(recorder) <----------- (recordee)`:
 *    The recordee disconnects and the recorder will finish the recording and
 *    assume that no more messages will be sent.
 *
 * If the recorder disconnects then the recordee will simply stop sending
 * messages.
 */
export namespace RemoteRecorderProtocol {
  /**
   * The recordee gives its recording information to the recorder. This is step
   * 1 in the protocol.
   *
   * The `name` is a human readable name for identifying the recorder.
   *
   * The `sampleRate` is the sample rate of the audio that the recordee will be
   * sending over.
   */
  export type RecordeeInfoMessage = {
    readonly name: string,
    readonly sampleRate: number,
  };

  /**
   * The recorder tells the recordee to start recording. This is step 2 in the
   * protocol.
   */
  export type RecorderStartMessage = 'start';
}
