import { Observable } from 'rxjs';

/**
 * A chunk of data that we got from recording the
 */
type WAVRecordingChunk = {
  /**
   * The time at which this is recorded in seconds. This value is relative to
   * the `AudioContext` which was used to record the `MediaStream`.
   */
  readonly time: number,
  /**
   * The actual channel data for the chunk that was recorded.
   */
  readonly data: Float32Array,
};

/**
 * We currently use a single `AudioContext` instance for recording only with
 * other contexts for audio playback, for example. We may want to reconsider
 * this approach and just use one global `AudioContext` for all use cases since
 * the number of `AudioContext`s we can create is limited.
 */
const __context__ = new AudioContext();

/**
 * Records the raw data from the audio of a `MediaStream` and pushes that data
 * in chunks to observers. To assemble the full audio data just add together
 * the channel data chunks.
 *
 * We record in mono. It makes sense for vocal podcasts as it reduces the size
 * of files and losing what “depth” stereo may provide means very little to
 * podcast listeners and the voice format. Highly produced podcasts will likely
 * want to record in stereo, but highly produced podcasts are not currently our
 * target audience. Thought leaders who are not experts in audio are our
 * audience. To better understand the difference between Mono and Stero see this
 * article on [“Mono vs. Stereo”][1] and this article on [“Should You Podcast in
 * Mono or Stereo?”][2].
 *
 * To understand how to change our implementation to support stereo see our
 * reference implementaion which supports both [stereo and mono][3].
 *
 * [1]: http://www.diffen.com/difference/Mono_vs_Stereo
 * [2]: https://theaudacitytopodcast.com/tap059-should-you-podcast-in-mono-or-stereo/
 * [3]: https://github.com/streamproc/MediaStreamRecorder/blob/bef0b2082853a6a68c45e3a9e0066d6757ca75c7/MediaStreamRecorder.js#L1151
 */
function record(
  stream: MediaStream,
  context: AudioContext = __context__,
): Observable<WAVRecordingChunk> {
  return new Observable<WAVRecordingChunk>(observer => {
    // Create the source audio node.
    const source = context.createMediaStreamSource(stream);
    // Create a script processor and let the implementation determine the buffer
    // size (that is why it is set to 0). We record in mono which is why we
    // have one input and output channel.
    const processor = context.createScriptProcessor(0, 1, 1);

    // Handles any data we get for processing. We basically just forward that
    // data to our observable.
    const handleAudioProcess = (event: AudioProcessingEvent) => {
      const { inputBuffer, playbackTime } = event;
      // Send the input channel data to our channel data observers.
      observer.next({
        time: playbackTime,
        data: inputBuffer.getChannelData(0),
      });
    };

    // Add the processor event listener.
    processor.addEventListener('audioprocess', handleAudioProcess);
    // Connect up the audio nodes.
    source.connect(processor);
    processor.connect(context.destination);

    return () => {
      // Remove the processor event listener.
      processor.removeEventListener('audioprocess', handleAudioProcess);
      // Disconnect all of our audio nodes.
      source.disconnect(processor);
      processor.disconnect(context.destination);
    };
  });
}

export const WAVRecorder = {
  record,
};
