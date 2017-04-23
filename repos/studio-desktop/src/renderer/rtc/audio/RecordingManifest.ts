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
  };
}
