import * as React from 'react';

export default function StudioUserAudioNotFound() {
  return (
    <p>
      Decode Studio could not find any audio input devices. This is most likely
      because your computer currently does not have any audio input devices.
      Please plug a microphone into your computer so that you can use Decode
      Studio.

      {/* TODO: Better copy and links to good microphones on Amazon with Amazon
        * affiliate links. */}
    </p>
  );
}
