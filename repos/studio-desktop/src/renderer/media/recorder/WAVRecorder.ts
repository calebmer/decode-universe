// /**
//  * The implementation of this file was written with reference in to the
//  * [`StereoAudioRecorder` in the `MediaStreamRecorder` project][1].
//  *
//  * [1]: https://github.com/streamproc/MediaStreamRecorder/blob/bef0b2082853a6a68c45e3a9e0066d6757ca75c7/MediaStreamRecorder.js#L1068-L1381
//  */

// import { Recorder, RecorderState, RecorderInvalidStateError } from './Recorder';

// export class WAVRecorder implements Recorder {
//   private internalState: RecorderState = RecorderState.inactive;

//   public get state(): RecorderState {
//     return this.internalState;
//   }

//   private readonly context: AudioContext;
//   private readonly source: MediaStreamAudioSourceNode;
//   private readonly processor: ScriptProcessorNode;

//   private leftChannel: Array<Float32Array> = [];
//   private rightChannel: Array<Float32Array> = [];
//   private recordingLength: number = 0;

//   constructor({
//     context,
//     stream,
//   }: {
//     context: AudioContext,
//     stream: MediaStream,
//   }) {
//     this.context = context;
//     this.source = context.createMediaStreamSource(stream);
//     this.processor = context.createScriptProcessor(0, 2, 2);
//   }

//   private handleAudioProcess = (event: AudioProcessingEvent) => {
//     // If we are not currently recording then we do not wish to process the
//     // audio from this event.
//     if (this.internalState !== RecorderState.recording) {
//       return;
//     }
//     const { inputBuffer } = event;
//     // Clone the left and right channel data and insert that data into the
//     // respective channels.
//     //
//     // TODO: In `drain` we call `flattenBuffers()` and `interleave()` to get the
//     // channel data into the right shape so that we may operate on it. Couldn’t
//     // we just flatten and interleave here? When we get the data? This may
//     // reduce some of the algorithmic complexities of `drain()` at the cost of
//     // allocating a new `Float32Array` whenever this event listener is called.
//     // This should be explored in the future if we find the performance of
//     // `drain()` to be unsatisfactory. For now we are trusting and following the
//     // reference implementation entirely.
//     this.leftChannel.push(new Float32Array(inputBuffer.getChannelData(0)));
//     this.rightChannel.push(new Float32Array(inputBuffer.getChannelData(1)));
//     // Increase the recording length in accordance to the processor buffer size.
//     this.recordingLength += this.processor.bufferSize;
//   };

//   public start(): void {
//     // Check the state.
//     if (this.internalState !== RecorderState.inactive) {
//       throw new RecorderInvalidStateError(this);
//     }
//     // Update the state.
//     this.internalState = RecorderState.recording;
//     // Reset the raw data that we use to collect audio data.
//     this.leftChannel = [];
//     this.rightChannel = [];
//     this.recordingLength = 0;
//     // Add the event listener to our processor.
//     this.processor.addEventListener('audioprocess', this.handleAudioProcess);
//     // Connect the nodes in our audio context.
//     this.source.connect(this.processor);
//     this.processor.connect(this.context.destination);
//   }

//   public async stop(): Promise<Blob> {
//     // Check the state.
//     if (this.internalState === RecorderState.inactive) {
//       throw new RecorderInvalidStateError(this);
//     }
//     // Update the state.
//     this.internalState = RecorderState.inactive;
//     // Remove the event listener from our processor.
//     this.processor.removeEventListener('audioprocess', this.handleAudioProcess);
//     // Disconnect the nodes in our audio context.
//     this.source.disconnect(this.processor);
//     this.processor.disconnect(this.context.destination);
//     // Create the blob and return it.
//     return this.createBlob();
//   }

//   public pause(): void {
//     // Check the state.
//     if (this.internalState !== RecorderState.recording) {
//       throw new RecorderInvalidStateError(this);
//     }
//     // Update the state.
//     this.internalState = RecorderState.paused;
//   }

//   public resume(): void {
//     // Check the state.
//     if (this.internalState !== RecorderState.paused) {
//       throw new RecorderInvalidStateError(this);
//     }
//     // Update the state.
//     this.internalState = RecorderState.recording;
//   }

//   private createBlob(): Blob {
//     // Extract all of the current data that we have accumulated while recording.
//     const { leftChannel, rightChannel, recordingLength } = this;
//     // Reset the data containers so that they are ready for new events.
//     this.leftChannel = [];
//     this.rightChannel = [];
//     this.recordingLength = 0;
//     // Flatten the channels.
//     const leftBuffer = flattenBuffers(leftChannel, recordingLength);
//     const rightBuffer = flattenBuffers(rightChannel, recordingLength);
//     // Interleave the two channels.
//     const interleaved = interleave(leftBuffer, rightBuffer);
//     // Create our WAV file.
//     const buffer = new ArrayBuffer(44 + interleaved.length * 2);
//     const view = new DataView(buffer);
//     // RIFF chunk descriptor.
//     writeUTFBytes(view, 0, 'RIFF');
//     view.setUint32(4, 44 + interleaved.length * 2 - 8, true); // -8 (via https://github.com/streamproc/MediaStreamRecorder/issues/97)
//     writeUTFBytes(view, 8, 'WAVE');
//     // FMT sub-chunk
//     writeUTFBytes(view, 12, 'fmt ');
//     view.setUint32(16, 16, true);
//     view.setUint16(20, 1, true);
//     // Stereo (2 channels)
//     view.setUint16(22, 2, true);
//     view.setUint32(24, this.context.sampleRate, true);
//     view.setUint32(28, this.context.sampleRate * 2 * 2, true); // numChannels * 2 (via https://github.com/streamproc/MediaStreamRecorder/pull/71)
//     view.setUint16(32, 2 * 2, true);
//     view.setUint16(34, 16, true);
//     // Data sub-chunk
//     writeUTFBytes(view, 36, 'data');
//     view.setUint32(40, interleaved.length * 2, true);
//     // Write the PCM samples
//     const volume = 1;
//     let index = 44;
//     for (let i = 0; i < interleaved.length; i++) {
//       view.setInt16(index, interleaved[i] * (0x7FFF * volume), true);
//       index += 2;
//     }
//     // Our final binary blob
//     const blob = new Blob([view], { type: 'audio/wav' });
//     return blob;
//   }
// }

// /**
//  * Flattens a nested `Float32Array` into a single `Float32Array`.
//  *
//  * In the reference implementation this is called [`mergeBuffers()`][1].
//  *
//  * [1]: https://github.com/streamproc/MediaStreamRecorder/blob/bef0b2082853a6a68c45e3a9e0066d6757ca75c7/MediaStreamRecorder.js#L1269-L1279
//  */
// function flattenBuffers(
//   channelBuffer: Array<Float32Array>,
//   recordingLength: number,
// ): Float32Array {
//   // Allocate a new array with the expected length.
//   const result = new Float32Array(recordingLength);
//   let offset = 0;
//   // For every buffer...
//   for (const buffer of channelBuffer) {
//     // Add it to the result and increment the offset by the buffer’s length.
//     result.set(buffer, offset);
//     offset += buffer.length;
//   }
//   return result;
// }

// /**
//  * Interleaves two `Float32Array`s so that if `a` were `[1, 2, 3]` and `b` were
//  * `[4, 5, 6]` then the result of interleaving the two would be:
//  * `[1, 3, 2, 5, 3, 6]`.
//  */
// function interleave(
//   leftBuffer: Float32Array,
//   rightBuffer: Float32Array,
// ): Float32Array {
//   // Allocate an array that is the length of the two channels combined.
//   const length = leftBuffer.length + rightBuffer.length;
//   const result = new Float32Array(length);
//   // The input index represents where we are in the `leftChannel` and
//   // `rightChannel` whereas `index` represents where we are in the `result`
//   // array. We expect `index` to grow twice as fast as `inputIndex`.
//   let index = 0;
//   let inputIndex = 0;
//   // Keep going until `index` has matched `length`.
//   while (index < length) {
//     result[index++] = leftBuffer[inputIndex];
//     result[index++] = rightBuffer[inputIndex];
//     inputIndex++;
//   }
//   return result;
// }

// /**
//  * Writes some UTF bytes from a string to a `DataView` at a given offset.
//  */
// function writeUTFBytes(view: DataView, offset: number, string: string): void {
//   for (var i = 0; i < string.length; i++) {
//     view.setUint8(offset + i, string.charCodeAt(i));
//   }
// }
