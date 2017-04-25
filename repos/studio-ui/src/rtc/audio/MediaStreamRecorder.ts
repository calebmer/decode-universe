import { Observable } from 'rxjs';

/**
 * We currently use a single `AudioContext` instance for recording only with
 * other contexts for audio playback, for example. We may want to reconsider
 * this approach and just use one global `AudioContext` for all use cases since
 * the number of `AudioContext`s we can create is limited.
 *
 * This `AudioContext` is also special because it optimizes for playback over
 * interactivity.
 */
// TypeScript doesn’t currently have types for `AudioContext` options so we have
// to cast the constructor as `any`.
const context: AudioContext = new (AudioContext as any)({
  latencyHint: 'playback',
});

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
function record(stream: MediaStream): Observable<Float32Array> {
  return new Observable<Float32Array>(observer => {
    // Create the source audio node.
    const source = context.createMediaStreamSource(stream);
    // Create a script processor. We record in mono which is why we have one
    // input and output channel. We also use the largest buffer size. This means
    // we will be sending the minimum number of messages over the network.
    const processor = context.createScriptProcessor(16384, 1, 1);
    // Handles any data we get for processing. We basically just forward that
    // data to our observable.
    const handleAudioProcess = (event: AudioProcessingEvent) => {
      const { inputBuffer } = event;
      // Clone the channel data and send the input channel data to our channel
      // data observers.
      observer.next(new Float32Array(inputBuffer.getChannelData(0)));
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

export const MediaStreamRecorder = {
  context,
  record,
};
