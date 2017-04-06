// Extend the `MediaDevices` provided by the TypeScript lib.
declare interface MediaDevices {
  /**
   * https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/enumerateDevices
   */
  enumerateDevices(): Promise<MediaDeviceInfo>,
}
