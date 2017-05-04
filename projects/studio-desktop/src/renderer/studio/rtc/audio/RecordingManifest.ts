/**
 * The manifest type represents a file which contains metadata for all of the
 * audio files that are a part of our recording. The format must be serializable
 *
 * to and deserializable from JSON.
 * We have a `version` number so that in the future we can support different
 * JSON manifest formats.
 */
export type RecordingManifest = {
  readonly version: '1',
  /**
   * The time in millseconds since the Unix epoch at which the recording was
   * started.
   */
  readonly startedAt: number,
  /**
   * A map of recorder ids to metadata about that recorder. The `id` key will
   * correspond to the file name of the recorder on disk.
   */
  readonly recorders: {
    [id: string]: RecordingManifest.Recorder,
  },
};

export namespace RecordingManifest {
  /**
   * The type for a single entry that can be found in the recording manifest.
   */
  export type Recorder = {
    /**
     * A human readable name for this recorder.
     */
    readonly name: string,
    /**
     * The sample rate at which the audio was recorded.
     */
    readonly sampleRate: number,
    /**
     * The time in milliseconds at which the recorder started *after* the
     * recording started. So if the recorder started at the same time as the
     * recording this value would be 0. If the recorder started 5 seconds after
     * the recording started this value would be 5000.
     *
     * Add this nomber to `recordedAt` to get the milliseconds since the Unix
     * epoch at which this recorder started.
     */
    readonly startedAtDelta: number,
  };
}
