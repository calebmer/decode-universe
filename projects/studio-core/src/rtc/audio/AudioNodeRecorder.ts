import { Observable } from 'rxjs';

/**
 * The buffer size we use when creating script processors. We use the highest
 * value which means we will be sending the minimum number of messages over the
 * network at all times.
 */
const bufferSize = 16384;

/**
 * Records the raw data from the audio of an `AudioNode` and pushes that data
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
  context: AudioContext,
  audio: AudioNode,
): Observable<Float32Array> {
  return new Observable<Float32Array>(observer => {
    // Create a script processor. We record in mono which is why we have one
    // input and output channel. We also use the largest buffer size. This means
    // we will be sending the minimum number of messages over the network.
    const processor = context.createScriptProcessor(bufferSize, 1, 1);
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
    audio.connect(processor);
    processor.connect(context.destination);
    return () => {
      // Remove the processor event listener.
      processor.removeEventListener('audioprocess', handleAudioProcess);
      // Disconnect all of our audio nodes.
      audio.disconnect(processor);
      processor.disconnect(context.destination);
    };
  });
}

/**
 * Creates an observable that will record silence at the same rate as `record()`
 * will record audio from an `AudioNode`.
 *
 * This is useful when someone is muted, but you still need some audio data to
 * fill in the space where they weren’t talking.
 */
function recordSilence(context: AudioContext): Observable<Float32Array> {
  return new Observable<Float32Array>(observer => {
    // Get the silence rate in milliseconds.
    const silenceRateInMS = (bufferSize / context.sampleRate) * 1000;
    // Create an interval which will emit silence data of `bufferSize` whenever
    // the interval ellapses.
    const intervalID = setInterval(
      () => {
        // Create the `Float32Array` with the correct size.
        const data = new Float32Array(bufferSize);
        // Fill the array with 0s which represent the actual silence data.
        data.fill(0);
        // Emit the silence data.
        observer.next(data);
      },
      silenceRateInMS,
    );
    return () => {
      // Clear the interval when we unsubscribe.
      clearInterval(intervalID);
    };
  });
}

export const AudioNodeRecorder = {
  record,
  recordSilence,
};