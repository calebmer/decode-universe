import * as React from 'react';

export function StudioUserAudioNotAllowed() {
  return (
    <p>
      Decode Studio could not get audio from any of your computer’s input
      devices. This is most likely because you have not given Decode Studio
      permission to access your audio. Please give Decode Studio access to your
      computer’s audio and then reload this page.

      {/* TODO: Better copy and instructions for how to give Decode Studio
        * permission in different browsers. */}
    </p>
  );
}
